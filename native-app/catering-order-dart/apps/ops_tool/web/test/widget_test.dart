import 'package:flutter_test/flutter_test.dart';
import 'package:ops_tool_web/main.dart';

void main() {
  testWidgets('App renders correctly', (WidgetTester tester) async {
    await tester.pumpWidget(const OpsToolApp());
    expect(find.text('门店'), findsOneWidget);
  });
}