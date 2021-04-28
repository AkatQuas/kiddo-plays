package generics

type Shape interface {
	Area() float64
}

func Perimeter(width, height float64) float64 {
	return (width + height) * 2
}

func Area(width, height float64) float64 {
	return width * height
}

func RectanglePerimeter(rectangle Rectangle) float64 {
	return Perimeter(rectangle.Width, rectangle.Height)
}

func RectangleArea(rectangle Rectangle) float64 {
	return Area(rectangle.Width, rectangle.Height)
}

func CircleArea(circle Circle) float64 {
	return 3.14 * circle.radius * circle.radius
}

type Rectangle struct {
	Width  float64
	Height float64
}

func (r Rectangle) Area() float64 {
	return Area(r.Width, r.Height)
}

type Circle struct {
	radius float64
}

func (c Circle) Area() float64 {
	return 3.14 * c.radius * c.radius
}

type Triangle struct {
	Base   float64
	Height float64
}

func (t Triangle) Area() float64 {
	return t.Base * t.Height / 2.0
}
