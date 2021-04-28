package generics

import "testing"

func assertEqual(t testing.TB, got, expected float64) {
	t.Helper()
	if got != expected {
		t.Errorf("got %.2f want %.2f", got, expected)
	}
}

func assertArea(t testing.TB, shape Shape, expected float64) {
	t.Helper()
	got := shape.Area()
	assertEqual(t, got, expected)
}

func TestPerimeter(t *testing.T) {
	t.Run("plain perimeter", func(t *testing.T) {
		got := Perimeter(10.0, 15.0)
		expected := 50.0
		assertEqual(t, got, expected)
	})

	t.Run("rectangle perimeter", func(t *testing.T) {
		rectangle := Rectangle{10.0, 15.0}
		got := RectanglePerimeter(rectangle)
		expected := 50.0
		assertEqual(t, got, expected)
	})
}

func TestArea(t *testing.T) {
	t.Run("plain area", func(t *testing.T) {
		got := Area(12.0, 7.0)
		expected := 84.0
		assertEqual(t, got, expected)
	})

	t.Run("rectangle area", func(t *testing.T) {
		rectangle := Rectangle{12.0, 7.0}
		got := RectangleArea(rectangle)
		got2 := rectangle.Area()
		expected := 84.0
		assertEqual(t, got, expected)
		assertEqual(t, got2, expected)
		assertArea(t, rectangle, expected)
	})

	t.Run("circles area", func(t *testing.T) {
		circle := Circle{11.0}
		got := CircleArea(circle)
		got2 := circle.Area()
		expected := 379.94
		assertEqual(t, got, expected)
		assertEqual(t, got2, expected)
		assertArea(t, circle, expected)
	})

	t.Run("triangle area", func(t *testing.T) {
		triangle := Triangle{10.0, 20.0}
		expected := 100.0
		assertArea(t, triangle, expected)
	})
}

func TestAreas(t *testing.T) {
	shapes := []struct {
		name  string
		shape Shape
		want  float64
	}{
		{"Rectangle", Rectangle{12.0, 6.0}, 72.0},
		{"Circle", Circle{10.0}, 314.0},
		{"Triangle", Triangle{12.0, 5.0}, 30.0},
	}

	for _, tt := range shapes {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.shape.Area()
			if got != tt.want {
				// The %#v format string will print out
				// the struct with the values in its field
				t.Errorf("%#v got %g want %g", tt.shape, got, tt.want)
			}
		})
	}
}
