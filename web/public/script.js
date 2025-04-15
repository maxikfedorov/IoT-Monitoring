const API_BASE_URL = "http://127.0.0.1:5000";

// Переменные для графиков
let currentSequenceChart;
let predictionsChart;

// Функция для подсчета статистики по датчикам
function calculateSensorStatistics(predictions) {
    const sensorStats = {};

    predictions.forEach(prediction => {
        Object.keys(prediction.sensors).forEach(sensorKey => {
            const sensor = prediction.sensors[sensorKey];
            const { status, name } = sensor;

            // Если датчик не существует в статистике, добавляем его
            if (!sensorStats[name]) {
                sensorStats[name] = { normal: 0, minor: 0, moderate: 0, critical: 0, total: 0 };
            }

            // Увеличиваем счетчик для текущего статуса
            sensorStats[name][status]++;
            sensorStats[name].total++;
        });
    });

    return sensorStats;
}

// Отображение таблицы статистики аномалий
function renderAnomaliesTable(predictions) {
    const anomaliesTable = document.getElementById('anomaliesTable').querySelector('tbody');
    anomaliesTable.innerHTML = ""; // Очищаем таблицу перед заполнением

    const sensorStats = calculateSensorStatistics(predictions);

    // Заполняем таблицу данными по каждому датчику
    Object.keys(sensorStats).forEach(sensorName => {
        const stats = sensorStats[sensorName];
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${sensorName}</td>
            <td>${stats.normal}</td>
            <td>${stats.minor}</td>
            <td>${stats.moderate}</td>
            <td>${stats.critical}</td>
            <td>${stats.total}</td>
        `;

        anomaliesTable.appendChild(row);
    });

    // Добавляем итоговую строку для сводки
    const summaryRow = document.createElement('tr');
    summaryRow.innerHTML = `
        <td><strong>Итого</strong></td>
        <td>${Object.values(sensorStats).reduce((sum, stats) => sum + stats.normal, 0)}</td>
        <td>${Object.values(sensorStats).reduce((sum, stats) => sum + stats.minor, 0)}</td>
        <td>${Object.values(sensorStats).reduce((sum, stats) => sum + stats.moderate, 0)}</td>
        <td>${Object.values(sensorStats).reduce((sum, stats) => sum + stats.critical, 0)}</td>
        <td>${Object.values(sensorStats).reduce((sum, stats) => sum + stats.total, 0)}</td>
    `;
    summaryRow.style.fontWeight = "bold";
    summaryRow.style.backgroundColor = "#e9ecef";
    anomaliesTable.appendChild(summaryRow);
}

// Функция для получения данных и отображения графиков
async function fetchAndRenderCharts() {
    try {
        const currentSequenceResponse = await fetch(`${API_BASE_URL}/current_sequence`);
        const predictionsResponse = await fetch(`${API_BASE_URL}/predictions`);
        const resultsResponse = await fetch(`${API_BASE_URL}/results`);

        if (!currentSequenceResponse.ok || !predictionsResponse.ok || !resultsResponse.ok) {
            throw new Error("Ошибка загрузки данных");
        }

        const currentSequence = await currentSequenceResponse.json();
        const predictions = await predictionsResponse.json();
        const analysisResults = await resultsResponse.json();

        renderCurrentSequenceChart(currentSequence);
        renderPredictionsChart(predictions);
        renderAnomaliesTable(analysisResults.predictions); // Передаем списки predictions для таблицы
    } catch (error) {
        console.error("Ошибка:", error);
    }
}


// Отображение графика текущей последовательности
function renderCurrentSequenceChart(currentSequence) {
    const ctx = document.getElementById('currentSequenceChart').getContext('2d');

    // Уничтожаем старый график (если есть)
    if (currentSequenceChart) currentSequenceChart.destroy();

    const labels = currentSequence.map(item => `ID ${item.seq_id}`);
    const datasets = Object.keys(currentSequence[0])
        .filter(key => key !== 'seq_id')
        .map(key => ({
            label: key,
            data: currentSequence.map(item => item[key]),
            borderWidth: 1,
            fill: false,
        }));

    currentSequenceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
            },
        },
    });
}

// Отображение графика прогнозов
function renderPredictionsChart(predictions) {
    const ctx = document.getElementById('predictionsChart').getContext('2d');

    // Уничтожаем старый график (если есть)
    if (predictionsChart) predictionsChart.destroy();

    // Проверяем, есть ли данные в predictions
    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
        alert("Прогнозы недоступны или данные отсутствуют.");
        return;
    }

    // Генерация меток (labels) и данных
    const labels = predictions.map(item => item.step ? `Шаг ${item.step}` : "Undefined");
    const datasets = Object.keys(predictions[0])
        .filter(key => key !== 'step')
        .map(key => ({
            label: key,
            data: predictions.map(item => item[key]),
            borderWidth: 1,
            fill: false,
        }));

    predictionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
            },
        },
    });
}

// Отображение сводки
function renderSummary(analysisResults) {
    const summaryContainer = document.getElementById('summaryContainer');
    const { anomalies_summary, total_records, timestamp } = analysisResults;

    summaryContainer.innerHTML = `
        <p><strong>Общее количество записей:</strong> ${total_records}</p>
        <p><strong>Последнее обновление:</strong> ${new Date(timestamp).toLocaleString()}</p>
        <p><strong>Статистика аномалий:</strong></p>
        <ul>
            <li><strong>Нормальных:</strong> ${anomalies_summary.normal}</li>
            <li><strong>Незначительных:</strong> ${anomalies_summary.minor}</li>
            <li><strong>Умеренных:</strong> ${anomalies_summary.moderate}</li>
            <li><strong>Критических:</strong> ${anomalies_summary.critical}</li>
        </ul>
    `;
}

// Инициализация последовательности
async function initializeSequence() {
    try {
        const response = await fetch(`${API_BASE_URL}/initialize`, {
            method: 'POST',
        });

        const result = await response.json();

        if (response.ok) {
            alert("Инициализация выполнена: " + result.message);
            fetchAndRenderCharts(); // Обновляем графики после инициализации
        } else {
            alert("Ошибка инициализации: " + result.message);
        }
    } catch (error) {
        console.error("Ошибка инициализации последовательности:", error);
    }
}

// Функция для выполнения прогнозирования
async function predictSteps() {
    const stepsInput = document.getElementById('stepsInput');
    const steps = parseInt(stepsInput.value, 10);

    if (isNaN(steps) || steps <= 0) {
        alert("Пожалуйста, введите корректное количество шагов для прогнозирования!");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ n_steps: steps }),
        });

        if (!response.ok) {
            const error = await response.json();
            alert(`Ошибка при прогнозировании: ${error.message}`);
            return;
        }

        const result = await response.json();
        renderPredictionsChart(result.predictions); // Обновляем график прогнозов
        alert(`Прогнозирование на ${steps} шагов выполнено успешно!`);
    } catch (error) {
        console.error("Ошибка прогнозирования:", error);
        alert("Ошибка выполнения запроса на прогнозирование!");
    }
}

// Функция для обработки загрузки JSON-файла
document.getElementById('uploadForm').addEventListener('submit', async event => {
    event.preventDefault();

    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Пожалуйста, выберите файл.");
        return;
    }

    try {
        const fileContent = await file.text();
        let parsedData;
        try {
            parsedData = JSON.parse(fileContent);

            if (!parsedData.records || !Array.isArray(parsedData.records)) {
                throw new Error("Файл должен содержать ключ 'records' с массивом объектов!");
            }

            if (!parsedData.records.every(record => typeof record === 'object')) {
                throw new Error("Массив 'records' должен содержать только объекты!");
            }
        } catch (parseError) {
            alert("Ошибка: файл не является валидным JSON!");
            console.error("Ошибка парсинга файла:", parseError);
            return;
        }

        const response = await fetch(`${API_BASE_URL}/add_records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedData),
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('uploadStatus').innerHTML =
                `<div class="alert alert-success">Записи успешно добавлены: ${result.added_records.length}</div>`;
            fetchAndRenderCharts(); // Обновляем графики после добавления записей
        } else {
            document.getElementById('uploadStatus').innerHTML =
                `<div class="alert alert-danger">Ошибка: ${result.message}</div>`;
        }
    } catch (error) {
        console.error("Ошибка обработки файла:", error);
        document.getElementById('uploadStatus').innerHTML =
            `<div class="alert alert-danger">Ошибка загрузки файла: ${error.message}</div>`;
    }
});

// Добавляем обработчик для кнопки инициализации
document.getElementById('initializeBtn').addEventListener('click', async function() {
    try {
        // Показываем индикатор загрузки или блокируем кнопку
        const button = this;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Инициализация...';
        
        // Вызываем API для инициализации последовательности
        const response = await fetch(`${API_BASE_URL}/initialize`, {
            method: 'POST',
        });

        const result = await response.json();

        if (response.ok) {
            alert("Инициализация выполнена: " + result.message);
            // Обновляем графики после инициализации
            fetchAndRenderCharts();
        } else {
            alert("Ошибка инициализации: " + result.message);
        }
    } catch (error) {
        console.error("Ошибка инициализации последовательности:", error);
        alert("Произошла ошибка при инициализации последовательности");
    } finally {
        // Восстанавливаем состояние кнопки
        this.disabled = false;
        this.textContent = 'Инициализация последовательности';
    }
});

// Добавляем обработчик для кнопки обновления графиков
document.getElementById('refreshBtn').addEventListener('click', async function() {
    try {
        // Показываем индикатор загрузки или блокируем кнопку
        const button = this;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Обновление...';
        
        // Вызываем функцию для получения данных и обновления графиков
        await fetchAndRenderCharts();
        
        // Показываем уведомление об успешном обновлении
        const notification = document.createElement('div');
        notification.className = 'alert alert-success position-fixed top-0 end-0 m-3';
        notification.style.zIndex = '1050';
        notification.textContent = 'Графики успешно обновлены';
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
    } catch (error) {
        console.error("Ошибка обновления графиков:", error);
        alert("Произошла ошибка при обновлении графиков");
    } finally {
        // Восстанавливаем состояние кнопки
        this.disabled = false;
        this.textContent = 'Обновить графики';
    }
});


// Добавление обработчиков для кнопки прогнозирования
document.getElementById('predictBtn').addEventListener('click', predictSteps);

// Инициализация
fetchAndRenderCharts();
