import threading
import time
import os
import json
from datetime import datetime
from pathlib import Path
from monitoring import load_predictions, analyze_predictions, write_json_output, print_summary

# Глобальные переменные для управления мониторингом
monitoring_thread = None
monitoring_active = False
monitoring_status = {
    "active": False,
    "started_at": None,
    "last_analysis": None,
    "analyzed_records": 0
}

DATA_FILE = Path("data_temp/predictions.json")
ANALYSIS_FILE = Path("data_temp/analysis_results.json")

def monitor_file_thread():
    """Функция для запуска в отдельном потоке для мониторинга файла"""
    global monitoring_status, monitoring_active
    
    last_modified = None
    last_analysis_time = 0
    
    print(f"MONITOR_START:{DATA_FILE}")
    monitoring_status["started_at"] = datetime.now().isoformat()
    
    while monitoring_active:
        try:
            if not os.path.exists(DATA_FILE):
                time.sleep(5)
                continue
            
            current_modified = os.path.getmtime(DATA_FILE)
            current_time = time.time()
            
            if (last_modified is None or 
                current_modified != last_modified or 
                current_time - last_analysis_time >= 60):
                
                action = "FIRST_RUN" if last_modified is None else "FILE_CHANGED" if current_modified != last_modified else "TIMEOUT"
                print(f"ANALYSIS:{action}")
                
                predictions = load_predictions()
                analysis = analyze_predictions(predictions)
                
                if analysis:
                    write_json_output(analysis, str(ANALYSIS_FILE))
                    print_summary(analysis)
                    monitoring_status["last_analysis"] = datetime.now().isoformat()
                    monitoring_status["analyzed_records"] = analysis["total_records"]
                
                last_modified = current_modified
                last_analysis_time = current_time
            
            time.sleep(1)
            
        except Exception as e:
            print(f"MONITOR_ERROR:{e}")
            time.sleep(5)
    
    print("MONITOR_STOPPED")

def start_monitoring():
    """Запуск мониторинга файла"""
    global monitoring_thread, monitoring_active
    
    if monitoring_active:
        return {
            'message': 'Мониторинг уже запущен', 
            'status': 'already_running'
        }, 400
    
    try:
        monitoring_active = True
        monitoring_thread = threading.Thread(target=monitor_file_thread)
        monitoring_thread.daemon = True
        monitoring_thread.start()
        
        monitoring_status["active"] = True
        monitoring_status["started_at"] = datetime.now().isoformat()
        
        return {
            'message': 'Мониторинг запущен успешно',
            'status': 'started',
            'timestamp': datetime.now().isoformat()
        }, 200
    except Exception as e:
        monitoring_active = False
        monitoring_status["active"] = False
        return {
            'error': f'Ошибка при запуске мониторинга: {str(e)}'
        }, 500

def stop_monitoring():
    """Остановка мониторинга файла"""
    global monitoring_active, monitoring_thread
    
    if not monitoring_active:
        return {
            'message': 'Мониторинг не запущен', 
            'status': 'not_running'
        }, 400
    
    try:
        monitoring_active = False
        if monitoring_thread and monitoring_thread.is_alive():
            # Ждем завершения потока максимум 5 секунд
            monitoring_thread.join(timeout=5)
        
        monitoring_status["active"] = False
        
        return {
            'message': 'Мониторинг остановлен успешно',
            'status': 'stopped',
            'timestamp': datetime.now().isoformat()
        }, 200
    except Exception as e:
        return {
            'error': f'Ошибка при остановке мониторинга: {str(e)}'
        }, 500

def get_monitoring_status():
    """Получение текущего статуса мониторинга"""
    return {
        'status': 'active' if monitoring_active else 'inactive',
        'details': monitoring_status,
        'timestamp': datetime.now().isoformat()
    }, 200

def analyze_now():
    """Выполнить анализ по требованию, независимо от изменения файла"""
    if not os.path.exists(DATA_FILE):
        return {
            'error': 'Файл с данными не найден', 
            'path': str(DATA_FILE)
        }, 404
    
    try:
        predictions = load_predictions()
        if not predictions:
            return {
                'error': 'Не удалось загрузить прогнозы из файла'
            }, 500
        
        analysis = analyze_predictions(predictions)
        if not analysis:
            return {
                'error': 'Не удалось проанализировать прогнозы'
            }, 500
        
        write_json_output(analysis, str(ANALYSIS_FILE))
        
        # Обновляем статус мониторинга
        monitoring_status["last_analysis"] = datetime.now().isoformat()
        monitoring_status["analyzed_records"] = analysis["total_records"]
        
        return {
            'message': 'Анализ выполнен успешно',
            'timestamp': datetime.now().isoformat(),
            'records_analyzed': analysis["total_records"],
            'anomalies': analysis["anomalies_summary"]
        }, 200
    except Exception as e:
        return {
            'error': f'Ошибка при выполнении анализа: {str(e)}'
        }, 500

def get_analysis_results():
    """Получить файл с результатами анализа"""
    file_path = str(ANALYSIS_FILE)
    
    if not os.path.exists(file_path):
        return {
            'error': 'Файл результатов анализа не найден'
        }, 404
    
    try:
        return file_path, 200
    except Exception as e:
        return {
            'error': f'Ошибка при доступе к файлу: {str(e)}'
        }, 500
