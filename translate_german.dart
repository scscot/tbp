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

  for (var key in enJson.keys) {
    if (key.startsWith('@')) continue;
    if (!deJson.containsKey(key)) {
      missingKeys.add(key);
    }
  }

  print('Total English keys: ${enJson.keys.where((k) => !k.startsWith('@')).length}');
  print('Total German keys: ${deJson.keys.where((k) => !k.startsWith('@')).length}');
  print('Missing keys: ${missingKeys.length}');
  print('\nMissing keys list:');
  for (var key in missingKeys) {
    print('$key: ${enJson[key]}');
  }
}
