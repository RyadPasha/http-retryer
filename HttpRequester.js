/**
 * A Node.js HTTP requester that sends requests with retry functionality.
 *
 * @class     HttpRequester
 * @author    Mohamed Riyad <m@ryad.me>
 * @link      https://RyadPasha.com
 * @copyright Copyright (C) 2023 RyadPasha. All rights reserved.
 * @license   MIT
 * @version   1.0.0-2023.07.29
 */

const os = require('os')
const axios = require('axios')
const mysql = require('mysql2')

/*
 * The database schema:
 *
 * CREATE TABLE `http_attempts` (
 *   `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 *   `request_id` varchar(36) NOT NULL,
 *   `attempt_number` int(10) unsigned NOT NULL,
 *   `error` varchar(255) DEFAULT NULL,
 *   `payload` json DEFAULT NULL,
 *   `abandoned` tinyint(1) unsigned NOT NULL DEFAULT '0',
 *   `hostname` varchar(255) DEFAULT NULL,
 *   `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   PRIMARY KEY (`id`)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
 */

class HttpRequester {
    /**
     * Create a new HttpRequester instance.
     *
     * @param {Object} dbConfigOrPool                  - The database configuration object or an existing connection pool.
     * @param {Object} requesterConfig                 - The configuration options for the requester.
     * @param {array}  requesterConfig.receiversUrl    - The URLs of the receiver APIs.
     * @param {number} [requesterConfig.timeout=5000]  - The timeout period for the request in milliseconds.
     * @param {number} [requesterConfig.maxAttempts=5] - The maximum number of attempts to make.
     */
    constructor(dbConfigOrPool, requesterConfig = {}) {
        if (dbConfigOrPool instanceof mysql.Pool) {
            /**
             * The MySQL connection pool.
             *
             * @type {mysql.Pool}
             */
            this.pool = dbConfigOrPool

            /**
             * The MySQL connection.
             *
             * @type {mysql.Connection}
             */
            this.connection = this.pool.promise()
        } else if (typeof dbConfigOrPool === 'object' && dbConfigOrPool !== null && !Array.isArray(dbConfigOrPool)) {
            /**
             * The MySQL connection pool.
             *
             * @type {mysql.Pool}
             */
            this.pool = mysql.createPool(dbConfigOrPool)

            /**
             * The MySQL connection.
             *
             * @type {mysql.Connection}
             */
            this.connection = this.pool.promise()
        } else {
            throw new Error('Invalid argument type for dbConfigOrPool. Expected an object or a mysql.Pool instance.')
        }

        // Validate the URLs
        if (!requesterConfig.receiversUrl) {
            throw new Error('Invalid argument type for requesterConfig.receiversUrl. Expected a string or an array.')
        } else if (typeof requesterConfig.receiversUrl === 'string' && (requesterConfig.receiversUrl.startsWith('http://') || requesterConfig.receiversUrl.startsWith('https://'))) {
            requesterConfig.receiversUrl = [requesterConfig.receiversUrl]
        } else if (!Array.isArray(requesterConfig.receiversUrl)) {
            throw new Error('Invalid argument type for requesterConfig.receiversUrl. Expected a string or an array.')
        } else if (requesterConfig.receiversUrl.length === 0) {
            throw new Error('Invalid argument value for requesterConfig.receiversUrl. Expected a non-empty array.')
        } else if (requesterConfig.receiversUrl.some((url) => typeof url !== 'string')) {
            throw new Error('Invalid argument value for requesterConfig.receiversUrl. Expected an array of strings.')
        } else if (requesterConfig.receiversUrl.some((url) => !url.startsWith('http://') && !url.startsWith('https://'))) {
            throw new Error('Invalid argument value for requesterConfig.receiversUrl. Expected an array of URLs.')
        }

        /**
         * The configuration options for the requester.
         *
         * @type {Object}
         * @property {array}  receiversUrl    - The URLs of the receiver APIs.
         * @property {number} [timeout=30000] - The timeout period for the request in milliseconds.
         * @property {number} [maxAttempts=5] - The maximum number of attempts to make.
         */
        this.config = {
            receiversUrl: [...new Set(requesterConfig.receiversUrl)],
            timeout: requesterConfig.timeout || 5000,
            maxAttempts: requesterConfig.maxAttempts || 5
        }

        /**
         * The hostname of the machine.
         * @type {string}
         */
        this.hostname = os.hostname().toUpperCase()

        // Process pending requests
        // this.checkPendingRequests().then(() => {
        //     console.log('Done processing pending requests.')
        // })
    }

    /**
     * Generate a random UUID (Version 4).
     *
     * @returns {string} A random UUID string.
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        })
    }

    /**
     * Delay the execution for a given amount of time (in milliseconds).
     *
     * @param   {number}    ms  - The time to sleep in milliseconds.
     * @returns {Promise<void>} A Promise that resolves after the specified delay.
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Send a request to the receivers API.
     *
     * @param   {Object}            payload - The payload to be sent in the request.
     * @returns {Promise<AxiosResponse>}    A Promise that resolves with the response.
     * @throws  {AxiosError}                If all attempts fail.
     */
    async sendRequest(payload) {
        for (let i = 0; i < this.config.receiversUrl.length; i++) {
            const receiver = this.config.receiversUrl[i]
            console.log(`Sending request to ${receiver} ...`)

            try {
                const response = await axios.post(receiver, payload, {
                    timeout: this.config.timeout
                })

                return response
            } catch (error) {
                console.log(`Request to ${receiver} failed.`)

                // Is last receiver?
                if (i === this.config.receiversUrl.length - 1) throw error
            }
        }
    }

    /**
     * Make an HTTP POST request with retry functionality.
     *
     * @param {number} [attempt=1]  - The current attempt number.
     * @param {Object} payload      - The payload to be sent in the request.
     */
    async makeHttpRequest(payload, attempt = 1, uniqueKey = null) {
        try {
            const response = await this.sendRequest(payload)

            // Success! Receiver is available, delete the record from the database
            if (attempt > 1 && uniqueKey) {
                await this.deleteAttemptRecord(uniqueKey)
            }
            console.log(`Request successful! Response code: ${response.status}`)
        } catch (error) {
            const statusCode = error.response ? error.response.status : error.code || null
            console.error(`Attempt ${attempt} failed with error: ${error.message} (Status code: ${statusCode})`)

            if (!uniqueKey) {
                // Generate a random unique key (UUID) for the request
                uniqueKey = this.generateUUID()
            }

            if (attempt < this.config.maxAttempts) {
                if (attempt === 1) {
                    // Insert a new record in the "http_attempts" table
                    console.log(`Inserting a new record in the "http_attempts" table...`)
                    this.insertAttemptRecord(uniqueKey, attempt, statusCode, payload)
                }

                // Retry after a certain delay based on the attempt number
                const delay = Math.pow(2, attempt) * 1000 // 2, 4, 8, 16, ...
                console.log(`Retrying after ${delay} milliseconds...`)
                await this.sleep(delay)

                // Make the next attempt
                await this.makeHttpRequest(payload, attempt + 1, uniqueKey)
            } else {
                if (attempt === 1) {
                    // Insert a new record in the "http_attempts" table
                    console.log(`Inserting a new record in the "http_attempts" table...`)
                    this.insertAttemptRecord(uniqueKey, attempt, statusCode, payload, 1)
                } else {
                    this.abandonAttemptRecord(uniqueKey, attempt, statusCode)
                }

                console.error('Maximum attempts reached. Request failed.')
            }
        }
    }

    /**
     * Retry making an HTTP POST request with the payload.
     * If the retry is successful, delete the record from the "http_attempts" table.
     *
     * @param {number} requestId - The request ID of the record in the "http_attempts" table.
     * @param {number} attempt   - The attempt number of the request.
     * @param {Object} payload   - The payload to be sent in the request.
     */
    async retryHttpRequest(requestId, attempt, payload) {
        try {
            const response = await this.sendRequest(payload)

            console.log(`Request successful! Response code: ${response.status}`)
            await this.deleteAttemptRecord(requestId)
        } catch (error) {
            console.error(`Retry attempt ${attempt} failed with error: ${error.message}`)

            if (attempt < this.config.maxAttempts) {
                // Retry after a certain delay based on the attempt number
                const delay = Math.pow(2, attempt) * 1000 // 2, 4, 8, 16, ...
                console.log(`Retrying after ${delay} milliseconds...`)
                await this.sleep(delay)

                // Make the next attempt
                await this.retryHttpRequest(requestId, attempt + 1, payload)
            } else {
                console.error(`Maximum attempts reached for record ID ${recordId}. Request failed.`)
            }
        }
    }

    /**
     * Fetch and process the pending requests from the "http_attempts" table in the database.
     */
    async checkPendingRequests() {
        try {
            const [rows] = await this.connection.execute('SELECT * FROM http_attempts')
            if (rows.length === 0) {
                console.log('No pending requests in the "http_attempts" table.')
            } else {
                console.log('Processing pending requests...')
                for (const row of rows) {
                    const { request_id, payload, attempt_number } = row

                    await this.retryHttpRequest(request_id, attempt_number, JSON.parse(payload))
                }
            }
        } catch (error) {
            console.error('Error while processing pending requests:', error.message)
        }
    }

    /**
     * Insert an attempt record into the database.
     *
     * @param {number} attempt      - The current attempt number.
     * @param {number} error        - The error code of the request.
     * @param {Object} payload      - The payload of the request.
     */
    async insertAttemptRecord(request_id, attempt, error, payload, abandoned = 0) {
        try {
            await this.connection.execute('INSERT INTO http_attempts (request_id, attempt_number, error, payload, abandoned, hostname) VALUES (?, ?, ?, ?, ?, ?)', [
                request_id,
                attempt,
                error,
                JSON.stringify(payload),
                abandoned,
                this.hostname
            ])
        } catch (error) {
            console.error('Error while inserting attempt record:', error.message)
        }
    }

    /**
     * Update an attempt record in the database.
     * Set the "abandoned" flag to 1 and update the attempt number and error code.
     *
     * @param {number} uniqueKey    - The request unique key (UUID).
     * @param {number} attempt      - The current attempt number.
     * @param {number} error        - The error code of the request.
     */
    async abandonAttemptRecord(uniqueKey, attempt, error) {
        try {
            await this.connection.execute('UPDATE http_attempts SET abandoned = ?, attempt_number = ?, error = ? WHERE request_id = ?', [1, attempt, error, uniqueKey])
        } catch (error) {
            console.error('Error while updating attempt record:', error.message)
        }
    }

    /**
     * Delete an attempt record from the database.
     *
     * @param {number} uniqueKey - The request unique key (UUID).
     */
    async deleteAttemptRecord(uniqueKey) {
        if (uniqueKey) {
            try {
                await this.connection.execute('DELETE FROM http_attempts WHERE request_id = ?', [uniqueKey])
            } catch (error) {
                console.error('Error while deleting attempt record:', error.message)
            }
        }
    }

    /**
     * Start the HTTP request process with the provided payload.
     *
     * @param {Object} payload - The payload to be sent in the request.
     */
    async startRequest(payload) {
        // Start the HTTP requests with the first attempt
        try {
            await this.makeHttpRequest(payload)
        } catch (error) {
            console.error('Error in the main process:', error.message)
        }
    }
}

module.exports = HttpRequester
