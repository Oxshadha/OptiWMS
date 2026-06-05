from config import calculate_volume, classify_volume

def get_float_input(prompt: str, min_val: float, max_val: float = float('inf')) -> float:
    while True:
        try:
            val = float(input(prompt))
            if min_val <= val <= max_val:
                return val
            elif max_val == float('inf'):
                print(f"  ⚠ Please enter a number greater than or equal to {min_val}")
            else:
                print(f"  ⚠ Please enter a number between {min_val} and {max_val}")
        except ValueError:
            print("  ⚠ Invalid input. Please enter a valid number.")

def get_string_input(prompt: str, valid_options: list[str]) -> str:
    while True:
        val = input(prompt).strip().lower()
        if val in valid_options:
            return val
        print(f"  ⚠ Invalid input. Please enter one of: {', '.join(valid_options)}")

def get_user_inputs() -> dict:
    print("\n--- Enter Parcel Details ---")
    weight = get_float_input("Weight (kg) [> 0, <= 500] : ", 0.001, 500.0)
    length = get_float_input("Length (cm) [> 0, <= 200] : ", 0.001, 200.0)
    width = get_float_input("Width (cm) [> 0, <= 100]  : ", 0.001, 100.0)
    height = get_float_input("Height (cm) [> 0]         : ", 0.001)
    movement_speed = get_string_input("Movement Speed (fast/medium/slow): ", ["fast", "medium", "slow"])

    volume_cm3 = calculate_volume(length, width, height)
    volume_class = classify_volume(volume_cm3)

    return {
        "weight": weight,
        "length": length,
        "width": width,
        "height": height,
        "product_volume": volume_class,
        "movement_speed": movement_speed,
        "volume_cm3": volume_cm3 
    }