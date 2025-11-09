.PHONY: i18n i18n-check i18n-pseudo flutter-clean flutter-get pseudo-ios-se

i18n:
	@echo "Running i18n toolchain..."
	cd locales && npm run i18n

i18n-check:
	@echo "Checking i18n integrity..."
	cd locales && npm run check
	@echo "Checking for raw string literals..."
	cd locales && npm run check:strings

i18n-pseudo:
	@echo "Generating pseudo-locale..."
	cd locales && npm run pseudo

flutter-clean:
	flutter clean

flutter-get:
	flutter pub get

flutter-build-pseudo:
	@echo "Building app with pseudo-locale enabled..."
	flutter build apk --debug --dart-define=PSEUDO_LOCALE=true

flutter-run-pseudo:
	@echo "Running app with pseudo-locale enabled..."
	flutter run --debug --dart-define=PSEUDO_LOCALE=true

pseudo-ios-se:
	@echo "🔍 Launching app in pseudo-locale (en-XA) on iPhone SE simulator..."
	flutter run --dart-define=PSEUDO_LOCALE=true -d "iPhone SE (3rd generation)"
