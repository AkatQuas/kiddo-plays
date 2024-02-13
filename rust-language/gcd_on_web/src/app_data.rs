use std::sync::Mutex;

pub struct Calculation(u64, u64, u64);

impl Calculation {
    pub fn new(n: u64, m: u64, gcd: u64) -> Calculation {
        Calculation(n, m, gcd)
    }

    // maybe we could use try into
    pub fn release(&self) -> (u64, u64, u64) {
        (self.0, self.1, self.2)
    }

    pub fn update(&mut self, n: u64, m: u64, gcd: u64) {
        self.0 = n;
        self.1 = m;
        self.2 = gcd;
    }
}

// This struct represents state
pub struct AppState {
    pub app_name: String,
    pub last_calculation: Mutex<Calculation>,
}

impl AppState {
    pub fn new(n: &str) -> AppState {
        AppState {
            app_name: String::from(n),
            last_calculation: Mutex::new(Calculation::new(1, 1, 1)),
        }
    }
}
