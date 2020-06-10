package payroll;

import static org.springframework.hateoas.server.mvc.WebMvcLinkBuilder.linkTo;
import static org.springframework.hateoas.server.mvc.WebMvcLinkBuilder.methodOn;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class EmployeeController {

  private final EmployeeRepository repository;
  private final EmployeeModelAssembler assembler;

  EmployeeController(final EmployeeRepository repository, EmployeeModelAssembler assembler) {
    this.repository = repository;
    this.assembler = assembler;
  }

  // Aggreate root

  @GetMapping("/employees")
  CollectionModel<EntityModel<Employee>> all() {
    // way 1, returnType is <List<Employee>>
    // return repository.findAll();

    // way2, returnType is <CollectionModel<EntityModel<Employee>>
    List<EntityModel<Employee>> employees = repository.findAll().stream() //
        .map(assembler::toModel) //
        .collect(Collectors.toList());

    return CollectionModel.of(employees, linkTo(methodOn(EmployeeController.class).all()).withSelfRel());
  }

  @PostMapping("/employees")
  Employee newEmployee(@RequestBody final Employee newEmployee) {
    return repository.save(newEmployee);
  }

  @GetMapping("/employees/{id}")
  EntityModel<Employee> one(@PathVariable final Long id) {
    // way 1, returnType is <Employee>
    // return repository.findById(id).orElseThrow(() -> new
    // EmployeeNotFoundException(id));

    // way 2, returnType is <EntityModel<Employee>>
    // Employee employee = repository.findById(id).orElseThrow(() -> new
    // EmployeeNotFoundException(id));

    // return EntityModel.of(employee,
    // linkTo(methodOn(EmployeeController.class).one(id)).withSelfRel(),
    // linkTo(methodOn(EmployeeController.class).all()).withRel("employees"));

    // way 3, returnType is <EntityModel<Employee>>
    Employee employee = repository.findById(id).orElseThrow(() -> new EmployeeNotFoundException(id));

    return assembler.toModel(employee);
  }

  @PutMapping("/employees/{id}")
  Employee replaceEmployee(@RequestBody final Employee newEmployee, @PathVariable final Long id) {
    return repository.findById(id).map(employee -> {
      employee.setName(newEmployee.getName());
      employee.setRole(newEmployee.getRole());
      return repository.save(employee);
    }).orElseGet(() -> {
      newEmployee.setId(id);
      return repository.save(newEmployee);
    });
  }

  @DeleteMapping("/employees/{id}")
  void deleteEmployee(@PathVariable final Long id) {
    repository.findById(id).orElseThrow(() -> new EmployeeNotFoundException(id));
    repository.deleteById(id);
  }

}
