import 'package:angular/angular.dart';

@Component(
  selector: 'my-history-item',
  template: '''
   <div class="history-item">
   <div class="time">Time: {{time}}</div>
   <div class="value">Amount: \$ {{value}}</div>
   </div>
  ''',
  styles: ['''
  .history-item { margin: 10px 20px; padding: 10px; border-radius: 10px; background-color: #999; color:  #fff; line-height: 30px; }
  '''],
  directives: [coreDirectives]
)
class HistoryItemComponent {
  @Input()
  String time;

  @Input()
  num value;
}