import 'package:angular/angular.dart';
import '../charge_service.dart';
import 'history_item_component.dart';

@Component(
    selector: 'my-history',
    styleUrls: ['history_component.css'],
    templateUrl: 'history_component.html',
    directives: [coreDirectives, HistoryItemComponent])
class HistoryComponent implements OnInit {
  final ChargeService chargeService;
  List<History> histories = [];

  HistoryComponent(this.chargeService);

  void ngOnInit() {
    this.getHistory();
  }

  void getHistory() async {
    final res = await chargeService.getHistory();
    histories = res.sublist(0, 4);
  }
}
