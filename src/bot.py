import os
import json
import requests
import telebot
import threading
import time
from dotenv import load_dotenv

load_dotenv()

API_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
bot = telebot.TeleBot(API_TOKEN)

CHATS_DIR = "chats"
CHATS_FILE = os.path.join(CHATS_DIR, "chats.json")
MESSAGE_PERIOD = 300

stop_signal = False
bot_thread = None
is_running = False
bot_lock = threading.Lock()

def ensure_chats_file():
    if not os.path.exists(CHATS_DIR):
        os.makedirs(CHATS_DIR)
    if not os.path.exists(CHATS_FILE):
        with open(CHATS_FILE, "w") as file:
            json.dump({}, file)

def load_chats():
    with open(CHATS_FILE, "r") as file:
        return json.load(file)

def save_chat(chat_id, metadata):
    chats = load_chats()
    chats[str(chat_id)] = metadata
    with open(CHATS_FILE, "w") as file:
        json.dump(chats, file, ensure_ascii=False, indent=4)

def get_anomalies():
    try:
        response = requests.get('http://127.0.0.1:5000/results')
        response.raise_for_status()
        return response.json().get('anomalies_summary', {})
    except Exception as e:
        print(f"Ошибка запроса: {e}")
        return None

@bot.message_handler(commands=['start'])
def handle_start(message):
    global stop_signal
    stop_signal = False  # Сбрасываем флаг остановки
    chat_id = message.chat.id
    chat_metadata = {
        "username": message.chat.username,
        "first_name": message.chat.first_name,
        "last_name": message.chat.last_name,
        "type": message.chat.type,
    }
    save_chat(chat_id, chat_metadata)
    bot.send_message(chat_id, f"Вы будете получать обновления каждые {MESSAGE_PERIOD} секунд.")
    start_updates_thread()

def start_updates_thread():
    global bot_thread
    if bot_thread is None or not bot_thread.is_alive():
        bot_thread = threading.Thread(target=send_periodic_updates, daemon=True)
        bot_thread.start()

@bot.message_handler(commands=['check'])
def handle_check(message):
    anomalies = get_anomalies()
    if anomalies:
        report = "Сводка по аномалиям:\n" + "\n".join(f"{k.capitalize()}: {v}" for k, v in anomalies.items())
    else:
        report = "Не удалось получить данные о аномалиях."
    bot.send_message(message.chat.id, report)

@bot.message_handler(commands=['stop'])
def handle_stop(message):
    global stop_signal
    stop_signal = True
    bot.send_message(message.chat.id, "Мониторинг остановлен. Вы можете снова запустить его командой /start.")

def send_periodic_updates():
    global stop_signal
    while not stop_signal:
        chats = load_chats()
        for chat_id, metadata in chats.items():
            anomalies = get_anomalies()
            if anomalies:
                message = "Сводка по аномалиям:\n" + "\n".join(f"{k.capitalize()}: {v}" for k, v in anomalies.items())
            else:
                message = "Не удалось получить данные о аномалиях."
            try:
                bot.send_message(chat_id, message)
            except Exception as e:
                print(f"Не удалось отправить сообщение в чат {chat_id}: {e}")
        time.sleep(MESSAGE_PERIOD)

def bot_polling():
    global stop_signal
    while not stop_signal:
        try:
            bot.polling(none_stop=True, timeout=60)
        except Exception as e:
            print(f"Ошибка в bot.polling(): {e}")
            time.sleep(10)

def start_bot():
    global is_running, stop_signal, bot_thread
    with bot_lock:
        if is_running:
            return {"message": "Бот уже запущен"}, 200
        
        is_running = True
        stop_signal = False
        
        ensure_chats_file()
        chats = load_chats()
        if chats:
            try:
                bot.send_message(list(chats.keys())[0], "Бот запущен и готов к работе.")
            except Exception as e:
                print(f"Не удалось отправить сообщение о запуске: {e}")
        
        # Запускаем поток для периодических обновлений
        threading.Thread(target=send_periodic_updates, daemon=True).start()
        
        # Запускаем бота в отдельном потоке
        bot_thread = threading.Thread(target=bot_polling, daemon=True)
        bot_thread.start()
        
        return {"message": "Бот успешно запущен"}, 200

def stop_bot():
    global is_running, stop_signal, bot_thread
    with bot_lock:
        if not is_running:
            return {"message": "Бот уже остановлен"}, 200
        
        stop_signal = True
        is_running = False
        
        # Уведомляем пользователей о выключении бота
        chats = load_chats()
        for chat_id in chats:
            try:
                bot.send_message(chat_id, "Бот остановлен администратором.")
            except Exception as e:
                print(f"Не удалось отправить сообщение о выключении в чат {chat_id}: {e}")
        
        # Ждем завершения потока бота
        if bot_thread:
            bot_thread.join(timeout=10)
        
        return {"message": "Бот успешно остановлен"}, 200

def get_bot_status():
    global is_running
    status = "running" if is_running else "stopped"
    return {"status": status}, 200

if __name__ == "__main__":
    # Автоматический запуск бота при прямом вызове скрипта
    start_bot()