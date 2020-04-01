import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { addTodo, seedTodo } from '../actions';

export default connect()(({ dispatch }) => {
    let input
    return (
        <Fragment>
            <div className="wrapper">
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        if (!input.value.trim()) {
                            return
                        }
                        dispatch(addTodo(input.value))
                        input.value = ''
                    }}
                >
                    <input type="text" ref={node => input = node} />
                    <button type="submit">Add Todo</button>
                </form>
                <div
                    onClick={_ => dispatch(seedTodo())}
                    className="seed"
                >seed some todos</div>
            </div>

            <style jsx>{`
                .wrapper {
                    display: flex;
                    justify-content: space-around;
                    .seed {
                        color: #fff;
                        background-color: darkcyan;
                        padding: 10px;
                        margin: 10px 0;
                    }

                }
            `}</style>
        </Fragment >
    )
})