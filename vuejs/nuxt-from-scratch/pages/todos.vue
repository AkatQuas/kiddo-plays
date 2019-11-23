<template>
    <div>

    <ul>
        <li v-for="todo in todos" :key="todo.text">
            <input type="checkbox" :checked="todo.done" @change="toggle(todo)">
            <span :class="{ done: todo.done }">{{ todo.text }}</span>
        </li>
        <li>
            <input type="text" placeholder="What needs to be done?" @keyup.enter="addTodo">
        </li>
    </ul>
    <button @click="increment">{{ counter }} - click to increment</button>
    </div>
</template>

<script>
import { mapMutations } from "vuex";
export default {
  created() {
    console.log(this.$store.state);
  },
  computed: {
    todos() {
      return this.$store.state.todos.list;
    },
    counter() {
      return this.$store.state.counter;
    }
  },
  methods: {
    increment() {
      this.$store.commit("increment");
    },
    addTodo(e) {
      this.$store.commit("todos/add", e.target.value);
      e.target.value = "";
    },
    ...mapMutations({
      toggle: "todos/toggle"
    })
  }
};
</script>

<style>
.done {
  text-decoration: line-through;
}
</style>
