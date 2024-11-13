const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Оголошення з'єднання з MySQL за допомогою mysql2
const db = mysql.createConnection({
    host: 'localhost',
    user: 'sto_user', 
    password: 'password123',
    database: 'car_service_station'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Підключено до бази даних MySQL');
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/layout', (req, res) => {
    if (!req.session.user) {
        // Якщо користувач не аутентифікований, перенаправляємо на сторінку входу
        return res.redirect('/login');
    }
    // Якщо користувач аутентифікований, рендеримо меню
    res.render('layout', { user: req.session.user }); // Передаємо користувача в шаблон
});

// Вихід користувача
app.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).send('Помилка при завершенні сесії');
            }
            // Перенаправлення на головну сторінку після виходу
            res.redirect('/login');
        });
    } else {
        // Якщо сесія не була ініціалізована
        res.redirect('/login');
    }
});

// Default route to login page
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Route to display login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    console.log("Username:", username);  // Логування введеного імені користувача
    console.log("Password:", password);  // Логування введеного пароля

    // SQL запит
    const sql = 'SELECT * FROM Users WHERE username = ? AND password = ?';
    
    db.query(sql, [username, password], (err, result) => {
        if (err) {
            console.error("Помилка запиту:", err);  // Логування помилки запиту
            return res.status(500).send("Помилка при аутентифікації.");
        }
        
        console.log("Результати запиту:", result);  // Логування результатів запиту

        if (result.length > 0) {
            // Користувач успішно аутентифікований
            // Перехід на головну сторінку з використанням layout.ejs
            res.render('layout', { username: username });
        } else {
            // Невірний логін або пароль
            res.render('login', { error: 'Невірний логін або пароль' });
        }
    });
});



// Перегляд всіх працівників
app.get('/employees', (req, res) => {
    const sql = "SELECT * FROM Employees";
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('employees', { employees: results });
    });
});

// Перегляд всіх замовлень
app.get('/orders', (req, res) => {
    const sql = `
        SELECT o.order_id, o.order_date, s.service_name, s.service_cost, e.first_name AS employee
        FROM Orders o
        JOIN Order_Services os ON o.order_id = os.order_id
        JOIN Services s ON os.service_id = s.service_id
        JOIN Employees e ON o.employee_id = e.employee_id;
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('orders', { orders: results });
    });
});

app.get('/total-price', (req, res) => {
    const sql = "SELECT SUM(service_cost) AS total_price FROM Services";
    db.query(sql, (err, result) => {
        if (err) throw err;

        // Перевіряємо, чи є сума
        const totalPrice = result[0].total_price || 0;  // Якщо сума відсутня, встановлюємо 0
        res.render('total-price', { totalPrice });
    });
});

// Route to display all clients
app.get('/clients', (req, res) => {
    const sql = "SELECT client_id, first_name, last_name, phone, email FROM Clients";
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Помилка при отриманні даних клієнтів.");
        }
        res.render('clients', { clients: results });
    });
});


// Вибірка всіх клієнтів та їхніх автомобілів
app.get('/clients-cars', (req, res) => {
    const sql = `
        SELECT c.first_name, c.last_name, ca.make, ca.model, ca.license_plate
        FROM Clients c
        JOIN Cars ca ON c.client_id = ca.owner_id;
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('clients-cars', { clientsCars: results });
    });
});

app.get('/employee-orders', (req, res) => {
    const sql = `
        SELECT e.first_name, e.last_name, COUNT(o.order_id) AS total_orders
        FROM Employees e
        LEFT JOIN Orders o ON e.employee_id = o.employee_id
        GROUP BY e.employee_id;
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).send('Помилка при запиті до бази даних.');
        }
        res.render('employee-orders', { employeeOrders: results });
    });
});


// Звіт про суму замовлень по кожному клієнту
app.get('/client-spending', (req, res) => {
    const sql = `
        SELECT o.order_id, o.order_date, s.service_name, s.service_cost, e.first_name AS employee, 
               c.first_name AS client_first_name, c.last_name AS client_last_name
        FROM Orders o
        JOIN Order_Services os ON o.order_id = os.order_id
        JOIN Services s ON os.service_id = s.service_id
        JOIN Employees e ON o.employee_id = e.employee_id
        JOIN Clients c ON o.client_id = c.client_id
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('client-spending', { clientSpending: results });
    });
});


app.get('/service-statistics', (req, res) => {
    const sql = `
        SELECT s.service_name, COUNT(os.order_service_id) AS times_ordered
        FROM Services s
        JOIN Order_Services os ON s.service_id = os.service_id
        GROUP BY s.service_id
        ORDER BY times_ordered DESC;
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('service-statistics', { serviceStats: results });
    });
});


// Перегляд замовлення за ID
app.get('/order/:id', (req, res) => {
    const sql = "SELECT * FROM Orders WHERE order_id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) throw err;
        res.render('order', { order: result[0] });
    });
});

// Маршрут для відображення форми додавання нового замовлення
app.get('/add-order', (req, res) => {
    res.render('add-order');
});

app.post('/add-order', (req, res) => {
    // Отримуємо дані з форми (req.body)
    const { order_date, client_id, car_id, employee_id, status, repair_type, price } = req.body;

    // Перевірка, чи всі необхідні значення присутні
    if (!client_id || !car_id || !employee_id || !status || !repair_type || !price) {
        return res.status(400).send("Усі поля повинні бути заповнені.");
    }

    // Запит на вставку даних у таблицю Orders
    const sql = `
        INSERT INTO Orders (order_date, client_id, car_id, employee_id, status, repair_type, price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [order_date, client_id, car_id, employee_id, status, repair_type, price], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Помилка при додаванні замовлення.");
        }
        res.redirect('/orders');
    });
});



app.get('/update-order', (req, res) => {
    const sql = "SELECT * FROM Orders";  // Вибірка всіх замовлень
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('update-order', { orders: results });  // передаємо замовлення в шаблон
    });
});



app.post('/update-order', (req, res) => {
    const { order_id, repair_type, price } = req.body;

    // SQL запит для оновлення замовлення
    const sql = `
        UPDATE Orders
        SET repair_type = ?, price = ?
        WHERE order_id = ?;
    `;
    
    db.query(sql, [repair_type, price, order_id], (err, result) => {
        if (err) throw err;
        res.redirect('/orders'); // Перехід на сторінку зі списком замовлень після успішного редагування
    });
});


app.get('/delete-order', (req, res) => {
    const sql = 'SELECT * FROM Orders'; // Отримуємо всі замовлення
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('delete-order', { orders: results }); // Відображаємо всі замовлення
    });
});

app.post('/delete-order/:id', (req, res) => {
    const orderId = req.params.id;
    const sql = 'DELETE FROM Orders WHERE order_id = ?';
    db.query(sql, [orderId], (err, result) => {
        if (err) throw err;
        res.redirect('/orders');
    });
});

// Отримати сторінку видалення клієнта
app.get('/delete-client', (req, res) => {
    const sql = "SELECT client_id, first_name, last_name, phone, email FROM Clients";
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('delete-client', { clients: results });
    });
});

app.post('/delete-client', (req, res) => {
    const clientId = req.body.client_id;

    if (!clientId) {
        console.error("Не вказано client_id");
        return res.status(400).send("Необхідно вибрати клієнта для видалення.");
    }

    // Спочатку видаляємо машини цього клієнта
    const deleteCarsSql = "DELETE FROM Cars WHERE OWNER_ID = ?";
    db.query(deleteCarsSql, [clientId], (err, result) => {
        if (err) {
            console.error("Помилка при видаленні машин:", err);
            return res.status(500).send("Помилка при видаленні машин клієнта.");
        }

        // Потім видаляємо клієнта
        const deleteClientSql = "DELETE FROM Clients WHERE client_id = ?";
        db.query(deleteClientSql, [clientId], (err, result) => {
            if (err) {
                console.error("Помилка при видаленні клієнта:", err);
                return res.status(500).send("Помилка при видаленні клієнта.");
            }

            if (result.affectedRows === 0) {
                console.error("Клієнт не знайдений, ID:", clientId);
                return res.status(404).send("Клієнта не знайдено.");
            }

            console.log("Клієнт успішно видалений, ID:", clientId);
            res.redirect('/clients');  // Повернення до списку клієнтів
        });
    });
});

// Створення маршруту для GET-запиту на сторінку додавання автомобіля
app.get('/add-car', (req, res) => {
    res.render('add-car'); // Рендеримо сторінку для додавання автомобіля
});

// Обробка запиту на додавання нового автомобіля
app.post('/add-car', (req, res) => {
    const { make, model, year, license_plate, owner_id } = req.body;

    // Перевірка, чи всі необхідні значення присутні
    if (!make || !model || !year || !license_plate || !owner_id) {
        return res.status(100).send("Усі поля повинні бути заповнені.");
    }

    // Запит на вставку даних у таблицю Cars
    const sql = `
        INSERT INTO Cars (make, model, year, license_plate, OWNER_ID)
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [make, model, year, license_plate, owner_id], (err, result) => {
        if (err) {
            console.error("Помилка при додаванні автомобіля:", err);
            return res.status(500).send("Помилка при додаванні автомобіля.");
        }
        console.log("Автомобіль успішно додано:", result);
        res.redirect('/clients');  // Перенаправлення до списку клієнтів після додавання автомобіля
    });
});


// Route to display add-client form
app.get('/add-client', (req, res) => {
    res.render('add-client');
});

// Route to handle form submission for adding a new client
app.post('/add-client', (req, res) => {
    // Get form data from req.body
    const { first_name, last_name, phone, email } = req.body;

    // Validate that all fields are provided
    if (!first_name || !last_name || !phone || !email) {
        return res.status(400).send("Усі поля повинні бути заповнені.");
    }

    // Insert new client into the Clients table
    const sql = `
        INSERT INTO Clients (first_name, last_name, phone, email)
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [first_name, last_name, phone, email], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Помилка при додаванні клієнта.");
        }
        res.redirect('/clients'); // Redirect to clients list or main page
    });
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});

app.use(express.static('public'));
