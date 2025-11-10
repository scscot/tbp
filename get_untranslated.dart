import 'dart:io';
import 'dart:convert';

void main() async {
  final enFile = File('/Users/sscott/tbp/lib/l10n/app_en.arb');
  final deFile = File('/Users/sscott/tbp/lib/l10n/app_de.arb');

  final enContent = await enFile.readAsString();
  final deContent = await deFile.readAsString();

  final enJson = json.decode(enContent) as Map<String, dynamic>;
  final deJson = json.decode(deContent) as Map<String, dynamic>;

  final untranslatedKeys = <String, String>{};

  for (var key in enJson.keys) {
    if (key.startsWith('@')) continue;

    final enValue = enJson[key] as String;
    final deValue = deJson[key];

    if (deValue == null || enValue == deValue || (deValue as String).contains('TODO') || (deValue as String).isEmpty) {
      untranslatedKeys[key] = enValue;
    }
  }

  final output = StringBuffer();
  for (var entry in untranslatedKeys.entries) {
    output.writeln('${entry.key}|||${entry.value}');
  }

  await File('/tmp/untranslated_keys.txt').writeAsString(output.toString());
  print('Found ${untranslatedKeys.length} untranslated keys');
  print('Output written to /tmp/untranslated_keys.txt');
}
