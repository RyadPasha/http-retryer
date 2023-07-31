## HTTP Retryer

### Overview

HTTP Retryer is a Node.js project that provides a custom HTTP requester with retry functionality. It is designed to send HTTP requests to multiple receiver APIs and automatically retry failed requests a configurable number of times. This project aims to improve the reliability and resilience of HTTP requests in the face of temporary failures.

### Features

-   Retry failed HTTP requests with configurable maximum attempts.
-   Send requests to multiple receiver APIs concurrently.
-   Store and process pending requests in case of receiver API unavailability.
-   Support for MySQL database to store and manage pending requests.
-   Automatic removal of successfully processed requests from the database.

### Requirements

-   Node.js version 12 or higher
-   MySQL server (if using the database feature)

### Installation

1. Clone the repository from GitHub:

    ```shell
    git clone https://gitlab.vianeos.com/mohamed.riyad/http-retryer.git
    cd http-retryer
    ```

2. Install the dependencies:

    ```shell
    npm install
    ```

3. Configure the MySQL database connection (optional):

    If you want to use the MySQL database for storing pending requests, make sure to set the appropriate environment variables in the `.env` file:

    ```.env
    DB_CONNECTION_LIMIT=
    DB_HOST=
    DB_USER=
    DB_PASS=
    DB_NAME=
    ```

    Update these variables with your actual database credentials.

### Usage

1. Import the `HttpRequester` class from the `HttpRequester.js` file into your own Node.js project.

2. Create an instance of the `HttpRequester` class by passing the MySQL database configuration and requester configuration:

    ```javascript
    const HttpRequester = require('./HttpRequester')

    const dbConfig = {
        connectionLimit: process.env.DB_CONNECTION_LIMIT,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        port: process.env.DB_PORT || 3306,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    }

    const config = {
        receiversUrl: ['http://localhost:3450/message', 'http://localhost:3459/message'],
        timeout: 5000, // 5 seconds
        maxAttempts: 3
    }

    const httpRequester = new HttpRequester(dbConfig, config)
    ```

3. Start sending HTTP requests with the `startRequest` method, passing the payload as an object:

    ```javascript
    const payload = {
        key1: 'value1',
        key2: 'value2'
    }

    httpRequester.startRequest(payload)
    ```

    The `startRequest` method will automatically handle retries for failed requests according to the configured maximum attempts.

### Mock Receiver App

To test the HTTP Retryer, you can use the provided mock receiver app in the `HttpReceiver.js` file. This app creates an Express server that listens for POST requests on the `/message` endpoint.

To run the Mock Receiver App, execute the following command:

```
node HttpReceiver.js
```

The app will start on port 3459, and you can use it as one of the receiver URLs in the `receiversUrl` configuration of the `HttpRequester`.

### License

This project is licensed under the MIT License - see the `LICENSE` file for details.

### Author

-   Mohamed Riyad
-   Email: [m@ryad.me](mailto:m@ryad.me)
-   Website: [RyadPasha.com](https://RyadPasha.com)
-   HackerRank: [RyadPash](https://hackerrank.com/RyadPasha)

### Version

-   Version: 1.0.0-2023.07.29
-   Release Date: 29th July 2023
