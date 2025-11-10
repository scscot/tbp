import 'dart:io';
import 'dart:convert';

void main() async {
  final enFile = File('/Users/sscott/tbp/lib/l10n/app_en.arb');
  final deFile = File('/Users/sscott/tbp/lib/l10n/app_de.arb');

  final enContent = await enFile.readAsString();
  final deContent = await deFile.readAsString();

  final enJson = json.decode(enContent) as Map<String, dynamic>;
  final deJson = json.decode(deContent) as Map<String, dynamic>;

  final missingKeys = <String>[];
  final sameAsEnglish = <String>[];
  final potentiallyUntranslated = <String>[];

  for (var key in enJson.keys) {
    if (key.startsWith('@')) continue;

    if (!deJson.containsKey(key)) {
      missingKeys.add(key);
    } else {
      final enValue = enJson[key] as String;
      final deValue = deJson[key] as String;

      if (enValue == deValue) {
        sameAsEnglish.add(key);
      }

      if (deValue.contains('TODO') || deValue.contains('TRANSLATE') || deValue.isEmpty) {
        potentiallyUntranslated.add(key);
      }
    }
  }

  print('Total English keys: ${enJson.keys.where((k) => !k.startsWith('@')).length}');
  print('Total German keys: ${deJson.keys.where((k) => !k.startsWith('@')).length}');
  print('Missing keys: ${missingKeys.length}');
  print('Same as English: ${sameAsEnglish.length}');
  print('Potentially untranslated (TODO/TRANSLATE/empty): ${potentiallyUntranslated.length}');

  if (sameAsEnglish.isNotEmpty) {
    print('\n=== KEYS WITH SAME VALUE AS ENGLISH (first 50): ===');
    for (var i = 0; i < sameAsEnglish.length && i < 50; i++) {
      final key = sameAsEnglish[i];
      print('$key: "${enJson[key]}"');
    }
  }

  if (potentiallyUntranslated.isNotEmpty) {
    print('\n=== POTENTIALLY UNTRANSLATED: ===');
    for (var key in potentiallyUntranslated) {
      print('$key: "${deJson[key]}"');
    }
  }

  if (missingKeys.isNotEmpty) {
    print('\n=== MISSING KEYS: ===');
    for (var key in missingKeys) {
      print('$key: "${enJson[key]}"');
    }
  }
}
