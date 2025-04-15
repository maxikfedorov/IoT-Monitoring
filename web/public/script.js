const API_BASE_URL = "http://127.0.0.1:5000";

function createCustomSpinner() {
    const wrapper = document.createElement('div');
    // Сохраняем вертикальную выравнивающую обёртку и margin кнопки
    wrapper.style.display = 'inline-block';
    wrapper.style.verticalAlign = 'middle';
    wrapper.style.width = '40px';
    wrapper.style.height = '40px';

    // Сохраняем класс для правильного внешнего вида рядом с input
    wrapper.className = 'me-3';

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.innerHTML = `
        <div class="double-bounce1"></div>
        <div class="double-bounce2"></div>
    `;
    spinner.setAttribute('id', 'predict-spinner');

    wrapper.appendChild(spinner);
    return wrapper;
}


function showNotification(message, type = "success") {
    const MAX_NOTIFICATIONS = 5;
    const container = ensureNotificationContainer();

    // Удаляем просроченные уведомления
    while (container.children.length >= MAX_NOTIFICATIONS) {
        // Удаляем самое старое (первое) уведомление
        container.firstChild.remove();
    }

    const notification = document.createElement('div');
    notification.className = `alert alert-${type} mb-2 shadow`;
    notification.textContent = message;

    // Удаляем уведомление через 3 секунды (или чуть позже, если стали старым)
    const removeNotification = () => {
        if (notification.parentNode) notification.remove();
    };
    setTimeout(removeNotification, 3000);

    container.appendChild(notification);
}

// В начале файла или перед первой функцией уведомлений
function ensureNotificationContainer() {
    let container = document.getElementById('notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1050';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        document.body.appendChild(container);
    }
    return container;
}


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
    const predictBtn = document.getElementById('predictBtn');
    const steps = parseInt(stepsInput.value, 10);

    if (isNaN(steps) || steps <= 0) {
        showNotification("Пожалуйста, введите корректное количество шагов для прогнозирования!", "danger");
        return;
    }

    // Заменяем кнопку на спиннер
    const spinner = createCustomSpinner();
    predictBtn.parentNode.replaceChild(spinner, predictBtn);

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ n_steps: steps }),
        });

        if (!response.ok) {
            const error = await response.json();
            showNotification(`Ошибка при прогнозировании: ${error.message}`, "danger");
            return;
        }

        const result = await response.json();
        renderPredictionsChart(result.predictions); // Обновляем график прогнозов
        showNotification(`Прогнозирование на ${steps} шагов выполнено успешно!`, "success");

    } catch (error) {
        console.error("Ошибка прогнозирования:", error);
        showNotification(`Ошибка при прогнозировании: ${error.message || "Произошла ошибка"}`, "danger");
    } finally {
        // Возвращаем кнопку на место спиннера
        const parent = spinner.parentNode;
        if (parent) parent.replaceChild(predictBtn, spinner);
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
document.getElementById('initializeBtn').addEventListener('click', async function () {
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
            showNotification("Инициализация выполнена: " + result.message, "success");
            fetchAndRenderCharts(); // Обновляем графики после инициализации
        } else {
            showNotification("Ошибка инициализации: " + result.message, "danger");
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
document.getElementById('refreshBtn').addEventListener('click', async function () {
    try {
        // Показываем индикатор загрузки или блокируем кнопку
        const button = this;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Обновление...';

        // Вызываем функцию для получения данных и обновления графиков
        await fetchAndRenderCharts();

        showNotification('Графики успешно обновлены');

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

// --- Управление ботом и мониторингом ---

async function updateBotButton() {
    const btn = document.getElementById('botToggleBtn');
    try {
        const res = await fetch(`${API_BASE_URL}/bot/status`);
        const { status } = await res.json();
        if (status === 'running') {
            btn.textContent = "Остановить бота";
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-outline-danger');
        } else {
            btn.textContent = "Запустить бота";
            btn.classList.remove('btn-outline-danger');
            btn.classList.add('btn-outline-secondary');
        }
    } catch {
        btn.textContent = "Ошибка бота";
        btn.disabled = true;
    }
}

async function toggleBot() {
    const btn = document.getElementById('botToggleBtn');
    btn.disabled = true;
    const action = btn.textContent.includes('Остановить') ? 'stop' : 'start';
    try {
        await fetch(`${API_BASE_URL}/bot/${action}`, { method: 'POST' });
    } catch { }
    await updateBotButton();
    btn.disabled = false;
}

document.getElementById('botToggleBtn').addEventListener('click', toggleBot);


// --- Кнопки управления мониторингом и ботом ---

async function updateBotButton() {
    const btn = document.getElementById('botToggleBtn');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/bot/status`);
        const json = await res.json();
        if (json.status === 'running') {
            btn.textContent = 'Остановить бота';
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-outline-danger');
        } else {
            btn.textContent = 'Запустить бота';
            btn.classList.remove('btn-outline-danger');
            btn.classList.add('btn-outline-secondary');
        }
        btn.disabled = false;
    } catch {
        btn.textContent = 'Ошибка состояния бота';
        btn.classList.remove('btn-outline-secondary', 'btn-outline-danger');
        btn.classList.add('btn-outline-dark');
        btn.disabled = true;
    }
}

async function updateMonitoringButton() {
    const btn = document.getElementById('monitoringToggleBtn');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/monitoring/status`);
        const json = await res.json();
        if (json.status === 'active') {
            btn.textContent = 'Остановить мониторинг';
            btn.classList.remove('btn-outline-success');
            btn.classList.add('btn-outline-danger');
        } else {
            btn.textContent = 'Включить мониторинг';
            btn.classList.remove('btn-outline-danger');
            btn.classList.add('btn-outline-success');
        }
        btn.disabled = false;
    } catch {
        btn.textContent = 'Ошибка мониторинга';
        btn.classList.remove('btn-outline-success', 'btn-outline-danger');
        btn.classList.add('btn-outline-dark');
        btn.disabled = true;
    }
}

async function toggleBot() {
    const btn = document.getElementById('botToggleBtn');
    btn.disabled = true;
    const action = btn.textContent.includes('Остановить') ? 'stop' : 'start';
    try {
        await fetch(`${API_BASE_URL}/bot/${action}`, { method: 'POST' });
    } catch { }
    await updateBotButton();
    btn.disabled = false;
}

async function toggleMonitoring() {
    const btn = document.getElementById('monitoringToggleBtn');
    btn.disabled = true;
    const action = btn.textContent.includes('Остановить') ? 'stop' : 'start';
    try {
        await fetch(`${API_BASE_URL}/monitoring/${action}`, { method: 'POST' });
    } catch { }
    await updateMonitoringButton();
    btn.disabled = false;
}

// Навешиваем обработчики после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('botToggleBtn').addEventListener('click', toggleBot);
    document.getElementById('monitoringToggleBtn').addEventListener('click', toggleMonitoring);

    // При первой загрузке страницы подгружаем статус
    updateBotButton();
    updateMonitoringButton();
});
