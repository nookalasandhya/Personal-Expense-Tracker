const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// Connect to the SQLite database
const db = new sqlite3.Database('personal_expense.db', (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Connected to the SQLite database.');
         // Create the categories table if it does not exist
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense')) NOT NULL
      )`, (err) => {
        if (err) {
          console.error(err.message);
        } else {
          console.log('Categories table created or already exists.');
        }
      });

      // Create the transactions table if it does not exist
      db.run(` CREATE TABLE transactions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
         category INTEGER,
         amount INTEGER NOT NULL,
         date DATE NOT NULL,
         description TEXT,
         FOREIGN KEY (category) REFERENCES categories(id));`, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Transactions table created or already exists.');

                  // Insert predefined income and expense categories
            const insertCategories = `
                INSERT INTO categories (name, type) VALUES 
                ('Salary', 'income'), 
                ('Freelance', 'income'), 
                ('Groceries', 'expense'), 
                ('Rent', 'expense'), 
                ('Utilities', 'expense')
            `;
      
            db.run(insertCategories, function (err) {
                if (err) {
                console.error(err.message);
                } else {
                console.log('Predefined categories inserted successfully.');
                }
            });
        }
      });
    }
  });

// POST API to insert a new transaction
app.post('/transactions', (req, res) => {
    const { type, category, amount, date, description } = req.body;  // Get transaction data from the request body
  
    // Validate required fields
    if (!type || !category || !amount || !date) {
      return res.status(400).json({
        message: 'Invalid request: type, category, amount, and date are required.',
      });
    }
  
    // SQL query to insert a new transaction
    const sql = `INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)`;
  
    // Execute the insert query
    db.run(sql, [type, category, amount, date, description], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
  
      // Return the newly created transaction ID
      res.status(201).json({
        message: 'Transaction created successfully',
        data: {
          id: this.lastID,
          type,
          category,
          amount,
          date,
          description
        }
      });
    });
});

// GET API to fetch all transactions
app.get('/transactions', (req, res) => {
    const sql = `SELECT * FROM transactions`;
  
    db.all(sql, [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        message: 'success',
        data: rows
      });
    });
});

// GET API to fetch a specific transaction by ID
app.get('/transactions/:id', (req, res) => {
    const { id } = req.params;  // Get the transaction ID from the URL parameter
    const sql = `SELECT * FROM transactions WHERE id = ?`;
  
    // Query the database for the transaction with the given ID
    db.get(sql, [id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // If no transaction is found, return a 404 error
      if (!row) {
        res.status(404).json({ 
          message: `Transaction with ID ${id} not found` 
        });
        return;
      }
  
      // If the transaction is found, return it
      res.json({
        message: 'success',
        data: row
      });
    });
});

// PUT API to update a transaction by ID
app.put('/transactions/:id', (req, res) => {
    const { id } = req.params;  // Get the 'id' from the request URL
    const { type, category, amount, date, description } = req.body;  // Get the updated data from the request body
  
    // SQL query to update the transaction
    const sql = `UPDATE transactions 
                 SET type = ?, category = ?, amount = ?, date = ?, description = ? 
                 WHERE id = ?`;
  
    // Execute the update query
    db.run(sql, [type, category, amount, date, description, id], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
  
      if (this.changes === 0) {
        // If no rows were updated, return a 404 response
        res.status(404).json({
          message: 'Transaction not found or no changes made',
          data: null
        });
      } else {
        // If the transaction was successfully updated, return a success response
        res.json({
          message: 'Transaction updated successfully',
          data: {
            id,
            type,
            category,
            amount,
            date,
            description
          }
        });
      }
    });
});


app.delete('/transactions/:id', (req, res) => {
    const { id } = req.params;  // Get the 'id' from the request URL
  
    // SQL query to delete the transaction by id
    const sql = `DELETE FROM transactions WHERE id = ?`;
  
    // Execute the delete query
    db.run(sql, [id], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
  
      if (this.changes === 0) {
        // If no rows were deleted, return a 404 response
        res.status(404).json({
          message: 'Transaction not found',
          data: null
        });
      } else {
        // If the transaction was successfully deleted, return a success response
        res.json({
          message: 'Transaction deleted successfully',
          data: {
            id
          }
        });
      }
    });
});

// GET API for summary (total income, total expense, and balance)
app.get('/summary', (req, res) => {
    const incomeQuery = `SELECT SUM(amount) AS total_income FROM transactions WHERE type = 'income'`;
    const expenseQuery = `SELECT SUM(amount) AS total_expense FROM transactions WHERE type = 'expense'`;
  
    // Initialize totals
    let totalIncome = 0;
    let totalExpense = 0;
  
    // Fetch total income
    db.get(incomeQuery, [], (err, incomeRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      totalIncome = incomeRow.total_income || 0;
  
      // Fetch total expense
      db.get(expenseQuery, [], (err, expenseRow) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        totalExpense = expenseRow.total_expense || 0;
  
        // Calculate balance
        const balance = totalIncome - totalExpense;
  
        // Return the summary response
        res.json({
          message: 'success',
          data: {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: balance
          }
        });
      });
    });
  });

// 404 Not Found Handler
app.use((req, res) => {
    res.status(404).json({ message: 'Not Found' });
});
  
// General Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
