use yew::prelude::*;

#[function_component(App)]
pub fn app() -> Html {
  html! {
    <main>
      <img class="logo" src="https://yew.rs/img/logo.png" alt="Yew logo" />
      <h1>{ "Hello 42!" }</h1>
      <span class="subtitle">{ "from Yew with" }<i class="heart" /></span>
    </main>
  }
}

enum Msg {
    AddOne,
}

struct Model {
    value: i64,
}

impl Component for Model {
    type Message = Msg;
    type Properties = ();

    fn create(_ctx: &Context<Self>) -> Self {
        Self {
            value: 0,
        }
    }

    fn update(&mut self, _ctx: &Context<Self>, msg: Self::Message) -> bool {
        match msg {
            Msg::AddOne => {
                self.value +=1;
                // the value has changed so we need to
                // re-render for it to appear on the page
                true
            }
        }
    }

    fn view(&self, ctx: &Context<Self>) -> Html {
        // This gives us a component's "`Scope`"
        // which allows us to send messages, etc to the component.
        let link = ctx.link();
        html! {
            <div>
                <button onclick={link.callback(|_| Msg::AddOne)}>{ "Click to add 1" }</button>
                <p>{ self.value }</p>
            </div>
        }
    }
}
