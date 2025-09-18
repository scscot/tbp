sscott@Mac tbp % firebase deploy --only functions

=== Deploying to 'teambuilder-plus-fe74d'...

i  deploying functions
i  functions: preparing codebase default for deployment
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
i  artifactregistry: ensuring required API artifactregistry.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
✔  artifactregistry: required API artifactregistry.googleapis.com is enabled
⚠  functions: package.json indicates an outdated version of firebase-functions. Please upgrade using npm install --save firebase-functions@latest in your functions directory.
⚠  functions: Please note that there will be breaking changes when you upgrade.
i  functions: Loading and analyzing source code for codebase default to determine what to deploy
i  functions: You are using a version of firebase-functions SDK (4.8.1) that does not have support for the newest Firebase Extensions features. Please update firebase-functions SDK to >=5.1.0 to use them correctly
Serving at port 8902

✅ Email template loaded successfully

i  functions: Loaded environment variables from .env.
i  functions: preparing functions directory for uploading...
i  functions: packaged /Users/sscott/tbp/functions (346.55 KB) for uploading
i  functions: packaged /Users/sscott/tbp/functions (347.06 KB) for uploading
i  functions: ensuring required API cloudscheduler.googleapis.com is enabled...
✔  functions: required API cloudscheduler.googleapis.com is enabled
i  functions: ensuring required API run.googleapis.com is enabled...
i  functions: ensuring required API eventarc.googleapis.com is enabled...
i  functions: ensuring required API pubsub.googleapis.com is enabled...
i  functions: ensuring required API storage.googleapis.com is enabled...
✔  functions: required API eventarc.googleapis.com is enabled
✔  functions: required API run.googleapis.com is enabled
✔  functions: required API storage.googleapis.com is enabled
✔  functions: required API pubsub.googleapis.com is enabled
i  functions: generating the service identity for pubsub.googleapis.com...
i  functions: generating the service identity for eventarc.googleapis.com...
i  functions: ensuring required API secretmanager.googleapis.com is enabled...
✔  functions: required API secretmanager.googleapis.com is enabled
✔  functions: functions folder uploaded successfully
i  functions: updating Node.js 20 (2nd Gen) function submitContactForm(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function submitContactFormHttp(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function sendDemoInvitation(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function handleAppleSubscriptionNotification(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function handleAppleSubscriptionNotificationV2(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function testAppleNotificationV2Setup(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function testGooglePlayNotificationSetup(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function checkExpiredTrials(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function checkTrialsExpiringSoon(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function checkSubscriptionsExpiringSoon(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateAppleReceipt(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function checkUserSubscriptionStatus(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateGooglePlayPurchase(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function handleGooglePlayNotification(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getNetwork(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getUserByReferralCode(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function registerUser(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getNetworkCounts(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getNewMembersYesterdayCount(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getFilteredNetwork(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function onNewChatMessage(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function recalculateTeamCounts(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function updateCanReadProfileOnChatCreate(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function notifySponsorOfBizOppVisit(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getMemberDetails(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function updateUserTimezone(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function clearAppBadge(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function onNotificationUpdate(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function onNotificationDelete(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function onChatUpdate(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function syncAppBadge(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function sendDailyTeamGrowthNotifications(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function sendDailyAccountDeletionSummary(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateReferralUrl(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function deleteUserAccount(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function generateBetaTesterCSVs(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function sendLaunchNotificationConfirmation(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function getFirestoreMetrics(us-central1)...
i  functions: updating Node.js 20 (1st Gen) function onNotificationCreated(us-central1)...
i  functions: updating Node.js 20 (1st Gen) function onChatMessageCreated(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateDeadTokenCleanup(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateBadgePathParity(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function validateTriggerGating(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function chatbot(us-central1)...
i  functions: updating Node.js 20 (1st Gen) function onUserProfileCompleted(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function triggerSponsorship(us-central1)...
i  functions: updating Node.js 20 (2nd Gen) function sendLaunchCampaign(us-central1)...
Could not create or update Cloud Run service syncappbadge, Container Healthcheck failed. Revision 'syncappbadge-00093-yiz' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/syncappbadge/revision_name/syncappbadge-00093-yiz&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22syncappbadge%22%0Aresource.labels.revision_name%3D%22syncappbadge-00093-yiz%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service handlegoogleplaynotification, Container Healthcheck failed. Revision 'handlegoogleplaynotification-00027-mil' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/handlegoogleplaynotification/revision_name/handlegoogleplaynotification-00027-mil&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22handlegoogleplaynotification%22%0Aresource.labels.revision_name%3D%22handlegoogleplaynotification-00027-mil%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service checksubscriptionsexpiringsoon, Container Healthcheck failed. Revision 'checksubscriptionsexpiringsoon-00071-cup' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/checksubscriptionsexpiringsoon/revision_name/checksubscriptionsexpiringsoon-00071-cup&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22checksubscriptionsexpiringsoon%22%0Aresource.labels.revision_name%3D%22checksubscriptionsexpiringsoon-00071-cup%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getnetwork, Container Healthcheck failed. Revision 'getnetwork-00089-dox' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getnetwork/revision_name/getnetwork-00089-dox&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getnetwork%22%0Aresource.labels.revision_name%3D%22getnetwork-00089-dox%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getnetworkcounts, Container Healthcheck failed. Revision 'getnetworkcounts-00088-jaw' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getnetworkcounts/revision_name/getnetworkcounts-00088-jaw&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getnetworkcounts%22%0Aresource.labels.revision_name%3D%22getnetworkcounts-00088-jaw%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service testapplenotificationv2setup, Container Healthcheck failed. Revision 'testapplenotificationv2setup-00028-rej' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/testapplenotificationv2setup/revision_name/testapplenotificationv2setup-00028-rej&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22testapplenotificationv2setup%22%0Aresource.labels.revision_name%3D%22testapplenotificationv2setup-00028-rej%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validategoogleplaypurchase, Container Healthcheck failed. Revision 'validategoogleplaypurchase-00027-jux' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validategoogleplaypurchase/revision_name/validategoogleplaypurchase-00027-jux&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validategoogleplaypurchase%22%0Aresource.labels.revision_name%3D%22validategoogleplaypurchase-00027-jux%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service updateusertimezone, Container Healthcheck failed. Revision 'updateusertimezone-00104-fox' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/updateusertimezone/revision_name/updateusertimezone-00104-fox&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22updateusertimezone%22%0Aresource.labels.revision_name%3D%22updateusertimezone-00104-fox%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validatereferralurl, Container Healthcheck failed. Revision 'validatereferralurl-00089-did' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validatereferralurl/revision_name/validatereferralurl-00089-did&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validatereferralurl%22%0Aresource.labels.revision_name%3D%22validatereferralurl-00089-did%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service deleteuseraccount, Container Healthcheck failed. Revision 'deleteuseraccount-00028-gof' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/deleteuseraccount/revision_name/deleteuseraccount-00028-gof&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22deleteuseraccount%22%0Aresource.labels.revision_name%3D%22deleteuseraccount-00028-gof%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getuserbyreferralcode, Container Healthcheck failed. Revision 'getuserbyreferralcode-00154-lec' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getuserbyreferralcode/revision_name/getuserbyreferralcode-00154-lec&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getuserbyreferralcode%22%0Aresource.labels.revision_name%3D%22getuserbyreferralcode-00154-lec%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service updatecanreadprofileonchatcreate, Container Healthcheck failed. Revision 'updatecanreadprofileonchatcreate-00139-xol' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/updatecanreadprofileonchatcreate/revision_name/updatecanreadprofileonchatcreate-00139-xol&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22updatecanreadprofileonchatcreate%22%0Aresource.labels.revision_name%3D%22updatecanreadprofileonchatcreate-00139-xol%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service generatebetatestercsvs, Container Healthcheck failed. Revision 'generatebetatestercsvs-00024-taf' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/generatebetatestercsvs/revision_name/generatebetatestercsvs-00024-taf&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22generatebetatestercsvs%22%0Aresource.labels.revision_name%3D%22generatebetatestercsvs-00024-taf%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service testgoogleplaynotificationsetup, Container Healthcheck failed. Revision 'testgoogleplaynotificationsetup-00026-cef' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/testgoogleplaynotificationsetup/revision_name/testgoogleplaynotificationsetup-00026-cef&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22testgoogleplaynotificationsetup%22%0Aresource.labels.revision_name%3D%22testgoogleplaynotificationsetup-00026-cef%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service handleapplesubscriptionnotification, Container Healthcheck failed. Revision 'handleapplesubscriptionnotification-00088-fij' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/handleapplesubscriptionnotification/revision_name/handleapplesubscriptionnotification-00088-fij&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22handleapplesubscriptionnotification%22%0Aresource.labels.revision_name%3D%22handleapplesubscriptionnotification-00088-fij%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getfilterednetwork, Container Healthcheck failed. Revision 'getfilterednetwork-00088-bed' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getfilterednetwork/revision_name/getfilterednetwork-00088-bed&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getfilterednetwork%22%0Aresource.labels.revision_name%3D%22getfilterednetwork-00088-bed%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validateapplereceipt, Container Healthcheck failed. Revision 'validateapplereceipt-00086-mat' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validateapplereceipt/revision_name/validateapplereceipt-00086-mat&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validateapplereceipt%22%0Aresource.labels.revision_name%3D%22validateapplereceipt-00086-mat%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service senddemoinvitation, Container Healthcheck failed. Revision 'senddemoinvitation-00024-ror' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/senddemoinvitation/revision_name/senddemoinvitation-00024-ror&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22senddemoinvitation%22%0Aresource.labels.revision_name%3D%22senddemoinvitation-00024-ror%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service checkexpiredtrials, Container Healthcheck failed. Revision 'checkexpiredtrials-00083-lip' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/checkexpiredtrials/revision_name/checkexpiredtrials-00083-lip&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22checkexpiredtrials%22%0Aresource.labels.revision_name%3D%22checkexpiredtrials-00083-lip%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getmemberdetails, Container Healthcheck failed. Revision 'getmemberdetails-00118-kux' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getmemberdetails/revision_name/getmemberdetails-00118-kux&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getmemberdetails%22%0Aresource.labels.revision_name%3D%22getmemberdetails-00118-kux%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service onchatupdate, Container Healthcheck failed. Revision 'onchatupdate-00096-fit' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/onchatupdate/revision_name/onchatupdate-00096-fit&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22onchatupdate%22%0Aresource.labels.revision_name%3D%22onchatupdate-00096-fit%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service onnewchatmessage, Container Healthcheck failed. Revision 'onnewchatmessage-00170-tus' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/onnewchatmessage/revision_name/onnewchatmessage-00170-tus&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22onnewchatmessage%22%0Aresource.labels.revision_name%3D%22onnewchatmessage-00170-tus%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service clearappbadge, Container Healthcheck failed. Revision 'clearappbadge-00097-xuc' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/clearappbadge/revision_name/clearappbadge-00097-xuc&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22clearappbadge%22%0Aresource.labels.revision_name%3D%22clearappbadge-00097-xuc%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service onnotificationdelete, Container Healthcheck failed. Revision 'onnotificationdelete-00096-kav' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/onnotificationdelete/revision_name/onnotificationdelete-00096-kav&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22onnotificationdelete%22%0Aresource.labels.revision_name%3D%22onnotificationdelete-00096-kav%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service senddailyteamgrowthnotifications, Container Healthcheck failed. Revision 'senddailyteamgrowthnotifications-00110-yav' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/senddailyteamgrowthnotifications/revision_name/senddailyteamgrowthnotifications-00110-yav&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22senddailyteamgrowthnotifications%22%0Aresource.labels.revision_name%3D%22senddailyteamgrowthnotifications-00110-yav%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service onnotificationupdate, Container Healthcheck failed. Revision 'onnotificationupdate-00096-wuj' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/onnotificationupdate/revision_name/onnotificationupdate-00096-wuj&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22onnotificationupdate%22%0Aresource.labels.revision_name%3D%22onnotificationupdate-00096-wuj%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service submitcontactformhttp, Container Healthcheck failed. Revision 'submitcontactformhttp-00035-loh' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/submitcontactformhttp/revision_name/submitcontactformhttp-00035-loh&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22submitcontactformhttp%22%0Aresource.labels.revision_name%3D%22submitcontactformhttp-00035-loh%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service handleapplesubscriptionnotificationv2, Container Healthcheck failed. Revision 'handleapplesubscriptionnotificationv2-00028-jev' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/handleapplesubscriptionnotificationv2/revision_name/handleapplesubscriptionnotificationv2-00028-jev&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22handleapplesubscriptionnotificationv2%22%0Aresource.labels.revision_name%3D%22handleapplesubscriptionnotificationv2-00028-jev%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service registeruser, Container Healthcheck failed. Revision 'registeruser-00174-loh' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/registeruser/revision_name/registeruser-00174-loh&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22registeruser%22%0Aresource.labels.revision_name%3D%22registeruser-00174-loh%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service submitcontactform, Container Healthcheck failed. Revision 'submitcontactform-00066-ric' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/submitcontactform/revision_name/submitcontactform-00066-ric&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22submitcontactform%22%0Aresource.labels.revision_name%3D%22submitcontactform-00066-ric%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service senddailyaccountdeletionsummary, Container Healthcheck failed. Revision 'senddailyaccountdeletionsummary-00027-peg' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/senddailyaccountdeletionsummary/revision_name/senddailyaccountdeletionsummary-00027-peg&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22senddailyaccountdeletionsummary%22%0Aresource.labels.revision_name%3D%22senddailyaccountdeletionsummary-00027-peg%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service recalculateteamcounts, Container Healthcheck failed. Revision 'recalculateteamcounts-00145-fuf' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/recalculateteamcounts/revision_name/recalculateteamcounts-00145-fuf&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22recalculateteamcounts%22%0Aresource.labels.revision_name%3D%22recalculateteamcounts-00145-fuf%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getnewmembersyesterdaycount, Container Healthcheck failed. Revision 'getnewmembersyesterdaycount-00037-zez' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getnewmembersyesterdaycount/revision_name/getnewmembersyesterdaycount-00037-zez&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getnewmembersyesterdaycount%22%0Aresource.labels.revision_name%3D%22getnewmembersyesterdaycount-00037-zez%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service checktrialsexpiringsoon, Container Healthcheck failed. Revision 'checktrialsexpiringsoon-00083-goc' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/checktrialsexpiringsoon/revision_name/checktrialsexpiringsoon-00083-goc&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22checktrialsexpiringsoon%22%0Aresource.labels.revision_name%3D%22checktrialsexpiringsoon-00083-goc%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service notifysponsorofbizoppvisit, Container Healthcheck failed. Revision 'notifysponsorofbizoppvisit-00133-pit' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/notifysponsorofbizoppvisit/revision_name/notifysponsorofbizoppvisit-00133-pit&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22notifysponsorofbizoppvisit%22%0Aresource.labels.revision_name%3D%22notifysponsorofbizoppvisit-00133-pit%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service sendlaunchnotificationconfirmation, Container Healthcheck failed. Revision 'sendlaunchnotificationconfirmation-00031-web' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/sendlaunchnotificationconfirmation/revision_name/sendlaunchnotificationconfirmation-00031-web&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22sendlaunchnotificationconfirmation%22%0Aresource.labels.revision_name%3D%22sendlaunchnotificationconfirmation-00031-web%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service getfirestoremetrics, Container Healthcheck failed. Revision 'getfirestoremetrics-00020-yem' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/getfirestoremetrics/revision_name/getfirestoremetrics-00020-yem&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22getfirestoremetrics%22%0Aresource.labels.revision_name%3D%22getfirestoremetrics-00020-yem%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validatedeadtokencleanup, Container Healthcheck failed. Revision 'validatedeadtokencleanup-00002-col' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validatedeadtokencleanup/revision_name/validatedeadtokencleanup-00002-col&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validatedeadtokencleanup%22%0Aresource.labels.revision_name%3D%22validatedeadtokencleanup-00002-col%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validatebadgepathparity, Container Healthcheck failed. Revision 'validatebadgepathparity-00002-xiy' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validatebadgepathparity/revision_name/validatebadgepathparity-00002-xiy&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validatebadgepathparity%22%0Aresource.labels.revision_name%3D%22validatebadgepathparity-00002-xiy%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service checkusersubscriptionstatus, Container Healthcheck failed. Revision 'checkusersubscriptionstatus-00086-qob' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/checkusersubscriptionstatus/revision_name/checkusersubscriptionstatus-00086-qob&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22checkusersubscriptionstatus%22%0Aresource.labels.revision_name%3D%22checkusersubscriptionstatus-00086-qob%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
Could not create or update Cloud Run service validatetriggergating, Container Healthcheck failed. Revision 'validatetriggergating-00002-sos' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/validatetriggergating/revision_name/validatetriggergating-00002-sos&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22validatetriggergating%22%0Aresource.labels.revision_name%3D%22validatetriggergating-00002-sos%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
✔  functions[onNotificationCreated(us-central1)] Successful update operation.
✔  functions[onChatMessageCreated(us-central1)] Successful update operation.
Could not create or update Cloud Run service sendlaunchcampaign, Container Healthcheck failed. Revision 'sendlaunchcampaign-00024-jid' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/sendlaunchcampaign/revision_name/sendlaunchcampaign-00024-jid&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22sendlaunchcampaign%22%0Aresource.labels.revision_name%3D%22sendlaunchcampaign-00024-jid%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
✔  functions[onUserProfileCompleted(us-central1)] Successful update operation.
Could not create or update Cloud Run service chatbot, Container Healthcheck failed. Revision 'chatbot-00022-gug' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout. This can happen when the container port is misconfigured or if the timeout is too short. The health check timeout can be extended. Logs for this revision might contain more information.

Logs URL: https://console.cloud.google.com/logs/viewer?project=teambuilder-plus-fe74d&resource=cloud_run_revision/service_name/chatbot/revision_name/chatbot-00022-gug&advancedFilter=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22chatbot%22%0Aresource.labels.revision_name%3D%22chatbot-00022-gug%22 
For more troubleshooting guidance, see https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start
