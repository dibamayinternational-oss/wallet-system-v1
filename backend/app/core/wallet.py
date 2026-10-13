def generate_wallet_number(user_id: int) -> str:
    return f"WAL-{100000 + user_id}"
