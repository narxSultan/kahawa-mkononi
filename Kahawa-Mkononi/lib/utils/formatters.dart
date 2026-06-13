import 'package:intl/intl.dart';

class Formatters {
  static final _dt = DateFormat('yyyy-MM-dd HH:mm');

  static String dateTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final d = DateTime.parse(iso).toLocal();
      return _dt.format(d);
    } catch (_) {
      return iso;
    }
  }
}

