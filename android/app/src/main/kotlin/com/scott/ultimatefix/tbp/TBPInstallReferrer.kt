package com.scott.ultimatefix.tbp

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

data class TBPReferral(
    val ref: String?,    // sponsor code
    val tkn: String?,    // token (may be null)
    val t: String?,      // campaign type (stringified int)
    val v: String?       // payload version
)

object TBPInstallReferrer {
    private const val TAG = "TBP-IR"
    private const val PREFS = "tbp_install_referrer"
    private const val KEY_CONSUMED = "consumed"
    private const val KEY_CACHED = "cached_payload"

    private val regex = Regex("""TBP_REF:([^;]*);TKN:([^;]*);T:([^;]+)(?:;V:([^;]+))?""")

    suspend fun fetchOnce(context: Context): TBPReferral? = withContext(Dispatchers.IO) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (sp.getBoolean(KEY_CONSUMED, false)) {
            parsePayload(sp.getString(KEY_CACHED, null))
        } else {
            val result = connectAndGet(context)
            val parsed = parsePayload(result?.installReferrer)
            sp.edit()
                .putBoolean(KEY_CONSUMED, true)
                .putString(KEY_CACHED, result?.installReferrer)
                .apply()
            parsed
        }
    }

    private fun parsePayload(payload: String?): TBPReferral? {
        if (payload.isNullOrBlank()) return null
        val m = regex.find(payload) ?: return null
        val ref = m.groupValues.getOrNull(1)?.trim().orEmpty().ifEmpty { null }
        val tkn = m.groupValues.getOrNull(2)?.trim().orEmpty().ifEmpty { null }
        val t   = m.groupValues.getOrNull(3)?.trim().orEmpty().ifEmpty { null }
        val v   = m.groupValues.getOrNull(4)?.trim().orEmpty().ifEmpty { null }
        Log.d(TAG, "parsed: ref=$ref tkn=${tkn?.take(8)}… t=$t v=$v")
        return TBPReferral(ref, tkn, t, v)
    }

    private data class IR(val installReferrer: String?, val clickTs: Long, val installTs: Long)

    private suspend fun connectAndGet(context: Context): IR? = suspendCancellableCoroutine { cont ->
        val client = InstallReferrerClient.newBuilder(context).build()
        client.startConnection(object : InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(responseCode: Int) {
                try {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            val details: ReferrerDetails = client.installReferrer
                            val ir = IR(
                                installReferrer = details.installReferrer,
                                clickTs = details.referrerClickTimestampSeconds,
                                installTs = details.installBeginTimestampSeconds
                            )
                            Log.d(TAG, "IR OK: ${ir.installReferrer?.take(60)}")
                            cont.resume(ir)
                        }
                        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> {
                            Log.w(TAG, "IR not supported on this device")
                            cont.resume(null)
                        }
                        InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                            Log.w(TAG, "IR service unavailable")
                            cont.resume(null)
                        }
                        else -> {
                            Log.w(TAG, "IR unknown response: $responseCode")
                            cont.resume(null)
                        }
                    }
                } catch (e: Throwable) {
                    Log.e(TAG, "IR error", e)
                    cont.resume(null)
                } finally {
                    try { client.endConnection() } catch (_: Throwable) {}
                }
            }
            override fun onInstallReferrerServiceDisconnected() {
                if (cont.isActive) cont.resume(null)
            }
        })

        cont.invokeOnCancellation {
            try { client.endConnection() } catch (_: Throwable) {}
        }
    }
}
