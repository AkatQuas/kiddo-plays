const _WeekLabel = const [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const _MonthLabel = const [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

List<String> getCurrentWeek() {
  final List<String> week = [];
  var now = DateTime.now();
  now = now.subtract(Duration(days: 1));
  for (var i = 0; i < 7; i++) {
    now = now.add(Duration(days: 1));
    week.add(
        '${_WeekLabel[now.weekday]}\n${_MonthLabel[now.month]} ${now.day}');
  }
  return week;
}
