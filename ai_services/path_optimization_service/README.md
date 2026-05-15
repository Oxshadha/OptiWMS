# Path Optimization Service

## Overview
The Path Optimization Service is designed to optimize warehouse routing for improved efficiency. It calculates the shortest and most efficient paths for warehouse operations, considering scenarios like blocked aisles and baseline comparisons.

## Features
- **Average Route Length**: Calculates the average length of generated routes.
- **Travel-Time Reduction**: Compares optimized routes with baseline routing.
- **Reroute Success**: Handles blocked-aisle scenarios dynamically.
- **Response Latency**: Measures the time taken to generate routes.

## How to Use
1. **Setup**:
   - Ensure all dependencies are installed (see `requirements.txt`).
   - Provide warehouse layout and order data as input.

2. **Run the Service**:
   ```bash
   python app/main.py
   ```

3. **Test the Service**:
   - Use the provided test cases to validate functionality.

## Metrics
- **Average Route Length**: Evaluates the efficiency of generated routes.
- **Travel-Time Reduction**: Measures improvement over baseline routing.
- **Reroute Success**: Assesses the ability to handle blocked aisles.
- **Response Latency**: Tracks the time taken for route generation.

## Folder Structure
- `app/`: Contains the main application logic.
- `tests/`: Includes test cases for the service.
- `data/`: Stores sample input data for testing.

## Future Enhancements
- Integration with real-time warehouse data.
- Support for additional optimization algorithms.
