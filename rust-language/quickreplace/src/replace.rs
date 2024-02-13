use regex::Regex;

pub fn replace(target: &str, replacement: &str, text: &str) -> Result<String, regex::Error> {
    let regex = Regex::new(target)?;

    Ok(regex.replace_all(text, replacement).to_string())
}
