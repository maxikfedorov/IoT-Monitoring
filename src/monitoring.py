import json
import os
import time
from datetime import datetime
from pathlib import Path

SENSOR_RANGES = {
    "temp_hum_1": (15, 32, "Температура воздуха"),
    "temp_hum_2": (50, 80, "Влажность воздуха"),
    "light_1": (800, 1600, "Освещенность"),
    "co2_1": (350, 700, "Уровень CO2"),
    "soil_moisture_1": (60, 80, "Влажность почвы"),
    "soil_temp_1": (18, 25, "Температура почвы"),
    "soil_ph_1": (6.0, 7.0, "pH почвы"),
    "ec_1": (1.0, 2.5, "Электропроводность почвы"),
    "leaf_wetness_1": (0.3, 0.7, "Влажность листьев")
}

DATA_FILE = Path("data_temp/predictions.json")

def classify_anomaly(value, min_val, max_val):
    if min_val <= value <= max_val:
        return "normal"
    range_width = max_val - min_val
    if value < min_val:
        deviation = (min_val - value) / range_width * 100
    else:
        deviation = (value - max_val) / range_width * 100
    if deviation <= 10:
        return "minor"
    elif deviation <= 30:
        return "moderate"
    else:
        return "critical"

def load_predictions():
    try:
        with open(DATA_FILE, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"ERR:FILE_NOT_FOUND:{DATA_FILE}")
        return None
    except json.JSONDecodeError:
        print(f"ERR:INVALID_JSON:{DATA_FILE}")
        return None
    except Exception as e:
        print(f"ERR:{e}")
        return None

def analyze_predictions(predictions):
    if not predictions:
        return None
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_records": len(predictions),
        "anomalies_summary": {"normal": 0, "minor": 0, "moderate": 0, "critical": 0},
        "predictions": []
    }
    
    for pred in predictions:
        step = pred.get("step", "unknown")
        prediction_result = {"step": step, "status": "normal", "sensors": {}}
        
        has_anomaly = False
        max_anomaly_level = "normal"
        anomaly_hierarchy = {"normal": 0, "minor": 1, "moderate": 2, "critical": 3}
        
        for sensor, (min_val, max_val, sensor_name) in SENSOR_RANGES.items():
            if sensor in pred:
                value = pred[sensor]
                if value < min_val or value > max_val:
                    has_anomaly = True
                    absolute_deviation = abs(min_val - value) if value < min_val else abs(value - max_val)
                    range_width = max_val - min_val
                    if value < min_val:
                        percent_deviation = (min_val - value) / range_width * 100
                    else:
                        percent_deviation = (value - max_val) / range_width * 100
                    
                    anomaly_class = classify_anomaly(value, min_val, max_val)
                    direction = "ниже" if value < min_val else "выше"
                    
                    if anomaly_hierarchy[anomaly_class] > anomaly_hierarchy[max_anomaly_level]:
                        max_anomaly_level = anomaly_class
                    
                    prediction_result["sensors"][sensor] = {
                        "value": value,
                        "status": anomaly_class,
                        "direction": direction,
                        "deviation_percent": percent_deviation,
                        "absolute_deviation": absolute_deviation,
                        "range": [min_val, max_val],
                        "name": sensor_name
                    }
                else:
                    prediction_result["sensors"][sensor] = {
                        "value": value,
                        "status": "normal",
                        "range": [min_val, max_val],
                        "name": sensor_name
                    }
        
        if has_anomaly:
            prediction_result["status"] = max_anomaly_level
        results["anomalies_summary"][prediction_result["status"]] += 1
        results["predictions"].append(prediction_result)
    
    return results

def write_json_output(analysis, output_file="data_temp/analysis_results.json"):
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

def print_summary(analysis):
    if not analysis:
        print("NO_DATA")
        return
    
    total = analysis["total_records"]
    norm = analysis["anomalies_summary"]["normal"]
    minor = analysis["anomalies_summary"]["minor"]
    moderate = analysis["anomalies_summary"]["moderate"]
    critical = analysis["anomalies_summary"]["critical"]
    
    print(f"RECORDS:{total} NORMAL:{norm} MINOR:{minor} MODERATE:{moderate} CRITICAL:{critical}")
    
    if critical > 0:
        print("CRITICAL_FOUND")
        critical_preds = [p for p in analysis["predictions"] if p["status"] == "critical"]
        for pred in critical_preds[:5]:
            print(f"STEP:{pred['step']}")
            for s, d in pred["sensors"].items():
                if d["status"] == "critical":
                    print(f"{d['name']}:{d['value']}:{d['direction']}:{d['absolute_deviation']:.2f}")

def monitor_file():
    last_modified = None
    last_analysis_time = 0
    
    print(f"MONITOR_START:{DATA_FILE}")
    
    while True:
        try:
            if not os.path.exists(DATA_FILE):
                print(f"WAITING_FOR_FILE:{DATA_FILE}")
                time.sleep(10)
                continue
            
            current_modified = os.path.getmtime(DATA_FILE)
            current_time = time.time()
            
            if (last_modified is None or current_modified != last_modified or current_time - last_analysis_time >= 60):
                action = "FIRST_RUN" if last_modified is None else "FILE_CHANGED" if current_modified != last_modified else "TIMEOUT"
                print(f"ANALYSIS:{action}")
                
                predictions = load_predictions()
                analysis = analyze_predictions(predictions)
                
                if analysis:
                    write_json_output(analysis)
                    print_summary(analysis)
                
                last_modified = current_modified
                last_analysis_time = current_time
            
            time.sleep(1)
            
        except KeyboardInterrupt:
            print("MONITOR_STOPPED")
            break
        except Exception as e:
            print(f"ERROR:{e}")
            time.sleep(5)

if __name__ == "__main__":
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    monitor_file()
