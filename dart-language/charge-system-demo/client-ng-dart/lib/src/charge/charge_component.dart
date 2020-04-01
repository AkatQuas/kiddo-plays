import 'dart:js';
import 'package:angular/angular.dart';
import '../charge_service.dart';
import '../history/history_item_component.dart';

@Component(
    selector: 'my-charge',
    styleUrls: ['charge_component.css'],
    templateUrl: 'charge_component.html',
    directives: [coreDirectives, HistoryItemComponent])
class ChargeComponent implements OnInit {
  final ChargeService chargeService;
  List<History> histories = [];
  List<Choice> choices = [];

  ChargeComponent(this.chargeService);

  void ngOnInit() {
    this.getChoices();
    this.getHistoryBy4();
  }

  void confirmCharge(num value) async {
    final res =
        context.callMethod('confirm', ['Do you want to charge \$ $value?']);
    if (res) {
      final ok = await chargeService.postCharge(value);
      if (ok) {
        getHistoryBy4();
      }
    }
  }

  void getHistoryBy4() async {
    final res = await chargeService.getHistory();
    histories = res.sublist(0, 4);
  }

  void getChoices() async {
    final res = await chargeService.getChoices();
    choices = res;
  }
}
