const express = require('express');
const path = require('path');
const cors = require('cors'); // Импортируем CORS

const app = express();
const PORT = 3000;

// Настройка CORS
app.use(cors({
    origin: 'http://127.0.0.1:5000', // Указываем хост API
    methods: ['GET', 'POST'], // Разрешенные методы
    allowedHeaders: ['Content-Type'] // Разрешенные заголовки
}));

// Подключаем статику
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Рендер основной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Клиент запущен на http://127.0.0.1:${PORT}`);
});
