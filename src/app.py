from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import os
import importlib.util
from model import initialize_sequence, add_records_to_sequence, predict_n_steps, sensor_columns
import monitoring_service as monitor

bot_module_path = os.path.join(os.path.dirname(__file__), "bot.py")
spec = importlib.util.spec_from_file_location("bot_module", bot_module_path)
bot_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot_module)

app = Flask(__name__)
CORS(app)  # Включение CORS для всего приложения

@app.route('/initialize', methods=['POST'])
def api_initialize_sequence():
    initialize_sequence()
    return jsonify({'message': 'Последовательность успешно инициализирована нулями.'})

@app.route('/add_records', methods=['POST'])
def api_add_records_to_sequence():
    data = request.get_json()
    if not data or 'records' not in data:
        return jsonify({'error': 'Некорректный запрос. Ожидается поле "records".'}), 400
    
    records = data['records']
    if not isinstance(records, list) or not all(isinstance(record, dict) for record in records):
        return jsonify({'error': 'Поле "records" должно быть списком JSON-объектов (ключ-значение).'}), 400
    
    try:
        # Преобразование записей из формата JSON-объектов в массивы
        processed_records = []
        for record in records:
            processed_records.append([record[col] for col in sensor_columns])
        add_records_to_sequence(processed_records)
    except KeyError as e:
        return jsonify({'error': f'Отсутствует ключ {str(e)} в одной из записей.'}), 400

    return jsonify({
        'message': f'{len(records)} записей добавлено в последовательность.',
        'added_records': records
    })

@app.route('/predict', methods=['POST'])
def api_predict_n_steps():
    data = request.get_json()
    if not data or 'n_steps' not in data:
        return jsonify({'error': 'Некорректный запрос. Ожидается поле "n_steps".'}), 400
    
    n_steps = data['n_steps']
    if not isinstance(n_steps, int) or n_steps <= 0:
        return jsonify({'error': 'Поле "n_steps" должно быть положительным целым числом.'}), 400
    
    predictions = predict_n_steps(n_steps)
    return jsonify({'predictions': predictions})  # Полноценный вывод с шагами


@app.route('/results', methods=['GET'])
def get_analysis_results():
    file_path, status_code = monitor.get_analysis_results()
    
    if status_code != 200:
        return jsonify(file_path), status_code
    
    try:
        return send_file(file_path, mimetype='application/json')
    except Exception as e:
        return jsonify({'error': f'Ошибка при отправке файла: {str(e)}'}), 500

@app.route('/monitoring/start', methods=['POST'])
def start_monitoring():
    result, status_code = monitor.start_monitoring()
    return jsonify(result), status_code

@app.route('/monitoring/stop', methods=['POST'])
def stop_monitoring():
    result, status_code = monitor.stop_monitoring()
    return jsonify(result), status_code

@app.route('/monitoring/status', methods=['GET'])
def check_monitoring_status():
    result, status_code = monitor.get_monitoring_status()
    return jsonify(result), status_code

@app.route('/monitoring/analyze_now', methods=['POST'])
def analyze_now():
    result, status_code = monitor.analyze_now()
    return jsonify(result), status_code

# Новые эндпоинты для управления ботом
@app.route('/bot/start', methods=['POST'])
def api_start_bot():
    result, status_code = bot_module.start_bot()
    return jsonify(result), status_code

@app.route('/bot/stop', methods=['POST'])
def api_stop_bot():
    result, status_code = bot_module.stop_bot()
    return jsonify(result), status_code

@app.route('/bot/status', methods=['GET'])
def api_bot_status():
    result, status_code = bot_module.get_bot_status()
    return jsonify(result), status_code

@app.route('/current_sequence', methods=['GET'])
def get_current_sequence():
    """Эндпоинт для получения содержимого файла current_sequence.json"""
    file_path = os.path.join('data_temp', 'current_sequence.json')
    try:
        if os.path.exists(file_path):
            return send_file(file_path, mimetype='application/json')
        else:
            return jsonify({"error": "Файл current_sequence.json не найден"}), 404
    except Exception as e:
        return jsonify({"error": f"Ошибка при чтении файла: {str(e)}"}), 500

@app.route('/predictions', methods=['GET'])
def get_predictions():
    """Эндпоинт для получения содержимого файла predictions.json"""
    file_path = os.path.join('data_temp', 'predictions.json')
    try:
        if os.path.exists(file_path):
            return send_file(file_path, mimetype='application/json')
        else:
            return jsonify({"error": "Файл predictions.json не найден"}), 404
    except Exception as e:
        return jsonify({"error": f"Ошибка при чтении файла: {str(e)}"}), 500


if __name__ == '__main__':
    # Создаем директории, если они не существуют
    os.makedirs(os.path.dirname(monitor.DATA_FILE), exist_ok=True)
    app.run(debug=True)
