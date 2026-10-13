from ultralytics import YOLO

model = YOLO("docling-project/ScreenParser")
results = model.predict(
        source="./test.png",
        imgsz=1280,
        conf=0.10,
        iou=0.10,
        save=True,
        project="runs",
        name="screenparser-predict"
)

for r in results:
    for box, cls_id, conf in zip(r.boxes.xyxy, r.boxes.cls, r.boxes.conf):
        x1, y1, x2, y2 = box.tolist()
        label = model.names[int(cls_id)]
        print(f"{label:20s}  conf={conf:.2f}  bbox=({int(x1)}, {int(y1)}, {int(x2-x1)}, {int(y2-y1)})")
