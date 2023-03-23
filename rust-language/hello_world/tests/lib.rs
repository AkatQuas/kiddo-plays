#[cfg(test)]

mod tests {
    use hello_world::{
        eat::{noodles, rice},
        phrases::greetings::{chinese, english},
    };

    #[test]
    fn english_greeting_correct() {
        assert_eq!("hello", english::hello());
    }

    #[test]
    #[should_panic]
    fn chinese_greeting_panic() {
        assert_eq!("iKun", chinese::hello());
    }

    #[test]
    #[ignore]
    fn whatever_is_ignored() {
        assert_eq!("iKun", chinese::hello());
    }

    #[test]
    fn what_you_eat() {
        assert_eq!("rice", rice());
        assert_eq!("noodles", noodles());
    }
}
