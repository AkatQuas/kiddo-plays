// students
// course
// Vec<Enrollment{ course, students }>
//
// Use mapping to avoid circular references.

struct Student {
    name: String,
}

impl Student {
    fn courses(&self, platform: Platform) -> Vec<String> {
        platform
            .enrollments
            .iter()
            .filter(|&e| e.student.name == self.name)
            .map(|e| e.course.name.clone())
            .collect()
    }
}

struct Course {
    name: String,
}

// Whenever a reference type appears inside another type’s definition
// write out its lifetime.
struct Enrollment<'a> {
    student: &'a Student,
    course: &'a Course,
}

impl<'a> Enrollment<'a> {
    fn new(student: &'a Student, course: &'a Course) -> Enrollment<'a> {
        Enrollment { student, course }
    }
}

struct Platform<'a> {
    enrollments: Vec<Enrollment<'a>>,
}

impl<'a> Platform<'a> {
    fn new() -> Platform<'a> {
        Platform {
            enrollments: Vec::new(),
        }
    }

    fn enroll(&mut self, student: &'a Student, course: &'a Course) {
        self.enrollments.push(Enrollment::new(student, course))
    }
}

pub fn mapping() {
    let mut p = Platform::new();
    let i_kun = Student {
        name: "iKun".into(),
    };

    let course = Course {
        name: "Dance".into(),
    };
    p.enroll(&i_kun, &course);

    let course = Course {
        name: "Basketball".into(),
    };
    p.enroll(&i_kun, &course);

    for c in i_kun.courses(p) {
        println!("{} is taking Course {}", i_kun.name, c);
    }
}
