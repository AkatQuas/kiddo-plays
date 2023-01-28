use std::{cell::RefCell, rc::Rc};

// Rc RefCell
struct Student {
    name: String,
    courses: Vec<Rc<RefCell<Course>>>,
}

impl Student {
    fn new(name: &str) -> Student {
        Student {
            name: name.into(),
            courses: Vec::new(),
        }
    }
}

struct Course {
    name: String,
    students: Vec<Rc<RefCell<Student>>>,
}

impl Course {
    fn new(name: &str) -> Course {
        Course {
            name: name.into(),
            students: Vec::new(),
        }
    }

    fn add_student(course: Rc<RefCell<Course>>, student: Rc<RefCell<Student>>) {
        student.borrow_mut().courses.push(course.clone());
        course.borrow_mut().students.push(student);
    }
}

pub fn circular_references() {
    let i_kun = Rc::new(RefCell::new(Student::new("iKun")));
    let course = Course::new("Dance");
    let magic_course = Rc::new(RefCell::new(course));

    Course::add_student(magic_course, i_kun);
}
