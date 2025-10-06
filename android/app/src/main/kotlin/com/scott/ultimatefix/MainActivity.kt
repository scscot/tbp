package com.scott.ultimatefix

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.scott.ultimatefix.tbp.TBPInstallReferrer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class MainActivity : FlutterActivity() {
    private val CHANNEL = "tbp/install_referrer"
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getInstallReferrer" -> {
                    scope.launch {
                        val referral = TBPInstallReferrer.fetchOnce(applicationContext)
                        val map = referral?.let {
                            mapOf(
                                "ref" to it.ref,
                                "tkn" to it.tkn,
                                "t"   to it.t,
                                "v"   to it.v
                            )
                        }
                        result.success(map)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
