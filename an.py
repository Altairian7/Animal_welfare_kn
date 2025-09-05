import cv2
import torch
from time import time, sleep
import requests
from datetime import datetime

# --------------------
# Load YOLOv5 model
# --------------------
print("📦 Loading YOLOv5 model...")
# For Apple Silicon Macs, you can specify the 'mps' device for GPU acceleration.
# Otherwise, 'cpu' is the default.
device = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
model.conf = 0.5   # confidence threshold
model.to(device)

# --------------------
# Initialize Webcam
# --------------------
# 0 refers to the default webcam.
# Change the index if you have multiple cameras.
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not cap.isOpened():
    print("❌ Error: Could not open webcam.")
    exit()

print("🚀 Animal detection started. Press 'q' to quit.")

# --------------------
# Settings
# --------------------
API_URL = "http://172.16.3.167:8000/animal/test-gemini/"
ANIMALS = ['dog', 'cat', 'bird', 'cow', 'sheep', 'horse']  # classes to detect
COOLDOWN = 5  # seconds between uploads
last_sent = 0

try:
    while True:
        # Capture frame
        ret, frame = cap.read()
        if not ret:
            print("Can't receive frame (stream end?). Exiting ...")
            break

        # Run YOLOv5 detection
        # Ensure the model and input tensor are on the same device
        results = model(frame)
        df = results.pandas().xyxy[0]  # detection results as dataframe

        detected = False

        # Draw bounding boxes + check for animals
        for _, row in df.iterrows():
            label = row['name']
            if label in ANIMALS:
                detected = True
                x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
                confidence = float(row['confidence'])

                # Draw box + label
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"{label} {confidence:.2f}", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # If animal detected and cooldown passed → save + send
        if detected and (time() - last_sent > COOLDOWN):
            filename = f"detected_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(filename, frame)

            try:
                files = {'image': open(filename, 'rb')}
                response = requests.post(API_URL, files=files)
                print(f"📤 Sent {filename} → API Response: {response.status_code}")
            except Exception as e:
                print("❌ Failed to send image:", e)

            last_sent = time()

        # Show live feed
        cv2.imshow("🐾 Animal Detection Feed", frame)

        # Quit if 'q' pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\n🛑 Stopped by user (Ctrl+C).")

finally:
    cap.release()
    cv2.destroyAllWindows()