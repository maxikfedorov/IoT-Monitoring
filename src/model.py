import os
import numpy as np
import joblib
import json
from tensorflow.keras.models import load_model # type: ignore

scaler = joblib.load('model/greenhouse_scaler.joblib')
model_info = joblib.load('model/greenhouse_model_info.joblib')
model = load_model('model/greenhouse_lstm_model.h5')
model.compile(optimizer='adam', loss='mean_squared_error')

seq_length = model_info['seq_length']
num_sensors = len(model_info['sensor_columns'])
sensor_columns = model_info['sensor_columns']

data_dir = 'data_temp'

sequence_file = os.path.join(data_dir, 'current_sequence.json')
predictions_file = os.path.join(data_dir, 'predictions.json')

def initialize_sequence():
    initial_sequence = np.zeros((seq_length, num_sensors))
    save_sequence(initial_sequence)

def load_sequence():
    with open(sequence_file, 'r') as f:
        sequence_json = json.load(f)
    sequence_array = np.array([[step[sensor] for sensor in sensor_columns] for step in sequence_json])
    return sequence_array

def add_records_to_sequence(records):
    sequence = load_sequence()
    for record in records:
        sequence = np.append(sequence[1:], [record], axis=0)
    save_sequence(sequence)

def save_sequence(sequence):
    sequence_json = []
    for i, step in enumerate(sequence):
        sequence_json.append({
            "seq_id": str(i + 1),
            **{sensor: float(step[j]) for j, sensor in enumerate(sensor_columns)}
        })
    with open(sequence_file, 'w') as f:
        json.dump(sequence_json, f, indent=4)

def save_predictions(predictions):
    predictions_json = []
    for prediction in predictions:
        predictions_json.append({
            "step": str(prediction["step"]),  # Сохраняем шаг
            **{sensor: float(prediction[sensor]) for sensor in sensor_columns}
        })
    with open(predictions_file, 'w') as f:
        json.dump(predictions_json, f, indent=4)


def predict_n_steps(n_steps):
    original_sequence = load_sequence()
    sequence = np.copy(original_sequence)
    predictions = []
    
    for step in range(1, n_steps + 1):
        sequence_input = sequence.reshape(1, seq_length, num_sensors)
        prediction_scaled = model.predict(sequence_input)[0]
        predictions.append({
            "step": step,  # Добавляем номер шага
            **{sensor_columns[j]: prediction_scaled[j] for j in range(num_sensors)}
        })

        sequence = np.append(sequence[1:], [prediction_scaled], axis=0)
    
    # Переводим значения прогнозов обратно в оригинальную шкалу
    predictions_original = [
        {
            "step": pred["step"],
            **{sensor: float(value) for sensor, value in zip(sensor_columns, scaler.inverse_transform([list(pred.values())[1:]])[0])}
        } 
        for pred in predictions
    ]

    save_predictions(predictions_original)  # Сохраняем с информацией о шагах
    return predictions_original
