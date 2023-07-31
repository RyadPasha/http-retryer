/**
 * Mock Receiver App
 *
 * @author    Mohamed Riyad <m@ryad.me>
 * @link      https://RyadPasha.com
 * @copyright Copyright (C) 2023 RyadPasha. All rights reserved.
 * @license   MIT
 * @version   1.0.0-2023.07.29
 */

const express = require('express')
const bodyParser = require('body-parser')

const app = express()

// Read environment variables
require('dotenv').config()

// Parse incoming request body as JSON
app.use(bodyParser.json())

// POST route to receive requests
app.post('/message', async (req, res) => {
    console.log('Received payload:', req.body)

    res.status(200).json({ message: 'Request received successfully.' })
})

// Start the server
const port = process.env.PORT || 3459
app.listen(port, () => {
    console.log(`Mock Receiver App listening at http://localhost:${port}`)
})
