# Hubbard Brook Ecosystem Modeling

This repository contains a full-stack application for visualizing and analyzing weather & ecosystem data from Hubbard Brook. The project is split into two halves: 
1. **FastAPI Python backend** for data processing
2. **Next.js/React frontend** for the user interface.

## Getting Started

To run the application locally, you will need to run the backend and frontend simultaneously. 
**Open two separate terminal windows** and follow the steps below.

### 1. Running the Backend (FastAPI)

The backend provides the API endpoints (`/weather-timeline` and `/weather-summary`) needed to power the frontend interface.

1. Open your first terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Activate the provided Python virtual environment:
   ```bash
   source venv/bin/activate
   ```
3. Install the required dependencies (only needed the first time):
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   python api.py
   ```
The backend server will begin running at `http://localhost:8000`. **Keep this terminal running.**

---

### 2. Running the Frontend (Next.js)

The frontend is a React-based application that creates the visual representations of the data from the backend API.

1. Open a **second** terminal window and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the Node.js dependencies (only needed the first time):
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
The frontend UI will begin running at `http://localhost:3000`. **Keep this terminal running.**

---

### 3. Viewing the App

Once both servers have successfully started, open your web browser and navigate to:
[**http://localhost:3000**](http://localhost:3000)

You can now interact with the data and use the date selector to view the ecosystem visualizations.
