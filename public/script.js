let mqttClient;

const seatMonitor = {
    trains: []
};

const mqtt_sub_topic = 'seats/status';
const mqtt_pub_topic = 'train/door/control';

function initializeTrains() {
    seatMonitor.trains = [
        {
            id: 'train-001',
            name: 'Train A',
            cars: [
                { id: 'car-1', name: 'Car 1', seats: generateSeats(3) },
                { id: 'car-2', name: 'Car 2', seats: generateSeats(3) },
                { id: 'car-3', name: 'Car 3', seats: generateSeats(3) },
                { id: 'car-4', name: 'Car 4', seats: generateSeats(3) },
                { id: 'car-5', name: 'Car 5', seats: generateSeats(3) }
            ]
        }
    ];
}

function generateSeats(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `seat-${i + 1}`,
        number: i + 1,
        status: Math.random() > 0.6 ? 'taken' : 'empty'
    }));
}

function renderTrains() {
    const container = document.getElementById('trainsContainer');
    container.innerHTML = '';
    seatMonitor.trains.forEach(train => {
        const trainStats = getTrainStatistics(train);
        const trainDiv = document.createElement('div');
        trainDiv.className = 'train-container';

        const headerHTML = `
            <div class="train-header">
                <div class="train-name">${train.name}</div>
                <div class="train-stats">
                    <div class="train-stat">Total: ${trainStats.total}</div>
                    <div class="train-stat">Available: ${trainStats.available}</div>
                    <div class="train-stat">Occupied: ${trainStats.occupied}</div>
                    <div class="train-stat">Rate: ${trainStats.rate}%</div>
                    <button class="close-door-btn" onclick="sendCloseDoor('${train.id}')">🚪 Close All Doors</button>
                    <button class="open-door-btn" onclick="sendOpenDoor('${train.id}')">🔓 Open All Doors</button>
                </div>
            </div>
        `;

        const carsHTML = `
            <div class="train-layout">
                <div class="car-grid">
                    ${train.cars.map(car => renderCar(car, train.id)).join('')}
                </div>
            </div>
        `;

        trainDiv.innerHTML = headerHTML + carsHTML;
        container.appendChild(trainDiv);
    });
}

function renderCar(car, trainId) {
    const totalSeats = car.seats.length;
    const occupiedSeats = car.seats.filter(seat => seat.status === 'taken').length;
    const occupancyRate = totalSeats > 0 ? occupiedSeats / totalSeats : 0;

    const carBgColor = `hsl(${120 - 120 * occupancyRate}, 70%, 60%)`;

    const seatRows = organizeSeatRows(car.seats);
    return `
        <div class="car" style="background:${carBgColor}; transition: background 0.5s;">
            <div class="car-header">
                <span>${car.name}</span>
                <button class="car-door-btn" onclick="sendCarCloseDoor('${trainId}', '${car.id}')">🚪</button>
            </div>
            <div class="seats-container">
                <div class="seat-section">
                    ${seatRows.left.map(row => `
                        <div class="seat-row">
                            ${row.map(seat => `
                                <div class="seat ${seat.status}" 
                                        data-seat-id="${seat.id}">
                                    ${seat.number}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                <div class="aisle">AISLE</div>
                <div class="seat-section">
                    ${seatRows.right.map(row => `
                        <div class="seat-row">
                            ${row.map(seat => `
                                <div class="seat ${seat.status}" 
                                        data-seat-id="${seat.id}">
                                    ${seat.number}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function organizeSeatRows(seats) {
    const left = [];
    const right = [];

    for (let i = 0; i < seats.length; i += 2) {
        const leftSeat = seats[i];
        const rightSeat = seats[i + 1];

        if (leftSeat) left.push([leftSeat]);
        if (rightSeat) right.push([rightSeat]);
    }

    return { left, right };
}

function getTrainStatistics(train) {
    const allSeats = train.cars.flatMap(car => car.seats);
    const total = allSeats.length;
    const occupied = allSeats.filter(seat => seat && seat.status === 'taken').length;
    const available = total - occupied;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, available, occupied, rate };
}

function updateStatistics() {
    const allSeats = seatMonitor.trains.flatMap(train =>
        train.cars.flatMap(car => car.seats)
    );
    const total = allSeats.length;
    const occupied = allSeats.filter(seat => seat && seat.status === 'taken').length;
    const available = total - occupied;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    document.getElementById('totalSeats').textContent = total;
    document.getElementById('availableSeats').textContent = available;
    document.getElementById('occupiedSeats').textContent = occupied;
    document.getElementById('occupancyRate').textContent = rate + '%';
}



function simulateDataUpdate() {
    seatMonitor.trains.forEach(train => {
        train.cars.forEach(car => {
            car.seats.forEach(seat => {
                if (Math.random() > 0.95) {
                    seat.status = seat.status === 'empty' ? 'taken' : 'empty';
                }
            });
        });
    });
    renderTrains();
    updateStatistics();
}

function handleWebSocketMessage(data) {
    if (data.cardId !== undefined && data.seats) {
        seatMonitor.trains.forEach(train => {
            const car = train.cars[data.cardId]; // Get car by index
            if (car) {
                // Update each seat in the car
                Object.keys(data.seats).forEach(seatIndex => {
                    const seatNumber = parseInt(seatIndex);
                    const seat = car.seats[seatNumber]; // Get seat by index
                    if (seat) {
                        seat.status = data.seats[seatIndex] ? 'taken' : 'empty';
                    }
                });
            }
        });
        renderTrains();
        updateStatistics();
    }
}

function initializeMQTT() {
    mqttClient = mqtt.connect('ws://192.168.249.180:9001');

    mqttClient.on('connect', () => {
        console.log('[MQTT CONNECTED]');

        mqttClient.subscribe(mqtt_sub_topic, (err) => {
            if (err) console.error('[MQTT SUBSCRIBE ERROR]', err);
            else console.log(`[MQTT SUBSCRIBED] ${mqtt_sub_topic}`);
        });
    });

    mqttClient.on('message', (topic, message) => {
        console.log(`[MQTT INCOMING] Topic: ${topic}`, message.toString());

        try {
            const data = JSON.parse(message.toString());

            if (topic === mqtt_sub_topic && data.cardId !== undefined && data.seats) {
                handleWebSocketMessage(data);
            }
        } catch (err) {
            console.error('[MQTT ERROR] Failed to parse', err);
        }
    });

    mqttClient.on('error', (err) => {
        console.error('[MQTT ERROR]', err);
    });

    mqttClient.on('close', () => {
        console.log('[MQTT DISCONNECTED]');
    });
}

function sendCloseDoor(trainId) {
    const message = {
        type: 'closeDoor',
        trainId: trainId,
        scope: 'all'
    };
    const json = JSON.stringify(message);
    console.log('[MQTT OUTGOING - ALL DOORS]', json);

    mqttClient.publish(mqtt_pub_topic, json);
}

function sendOpenDoor(trainId) {
    const message = {
        type: 'openDoor',
        trainId: trainId,
        scope: 'all'
    };
    const json = JSON.stringify(message);
    console.log('[MQTT OUTGOING - OPEN ALL DOORS]', json);

    mqttClient.publish(mqtt_pub_topic, json);
}

function sendCarCloseDoor(trainId, carId) {
    const message = {
        type: 'closeDoor',
        trainId: trainId,
        carId: carId,
        scope: 'car'
    };
    const json = JSON.stringify(message);
    console.log('[MQTT OUTGOING - CAR DOOR]', json);

    mqttClient.publish(mqtt_pub_topic, json);
}

initializeTrains();
renderTrains();
updateStatistics();
initializeMQTT();