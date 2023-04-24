# webSocket-chatroom

## Run Server

To run the server, follow these steps:

1. Install dependencies:
```
npm install
```

2. Start the development server:
```
npm run dev
```


3. Open your browser's Developer Tools, then enter the following command in the console to set the JWT token in localStorage (replace `{jwtToken}` with an actual JWT token):

```
localStorage.setItem('jwtToken', '{jwtToken}')
```
For example:
```
localStorage.setItem('jwtToken', 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1YTE5NWJmNGMyZTk0MWNmYjBmYzI5N2Y5YzQ4YWQ5NiIsImlhdCI6MTY4MDA5OTk1OCwiZXhwIjoxNjgwOTYzOTU4fQ.BJVv9bezUui8tWm9PWjzEZkYYkAASVa4oeaqAsrsQIrDXEEblRAkQ-DTnAlj5UlZVtvbUbI8omAUqsIGH8PnJA')
```

4. Open your browser and navigate to localhost:3000/main.
