import {
  cartActions,
  checkoutCart,
  selectCartItems,
  selectCartOrder,
  selectCartStatus,
  selectTotal,
} from '@acme/cart/data-access';
import { Button } from '@acme/ui';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

export const MoreBooks = ({}) => {
  const navigate = useNavigate();
  return (
    <Button onClick={() => navigate('/books', { replace: true })}>
      Find some books
    </Button>
  );
};

const StyledCartFeature = styled.div`
  .item {
    display: flex;
    align-items: center;
    padding-bottom: 9px;
    margin-bottom: 9px;
    border-bottom: 1px #ccc solid;
  }

  .description {
    flex: 1;
  }
  .cost {
    width: 10%;
  }
  .action {
    width: 10%;
  }
`;

export const CartFeature = () => {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const status = useSelector(selectCartStatus);
  const order = useSelector(selectCartOrder);
  const total = useSelector(selectTotal);
  return (
    <StyledCartFeature>
      <h1>My Cart</h1>
      {order ? (
        <p>
          Thank you for ordering. Your order number is <strong>#{order}</strong>
          .&nbsp;&nbsp;
          <MoreBooks />
        </p>
      ) : (
        <>
          {cartItems.length === 0 ? (
            <p>
              Your cart is empty. &nbsp;&nbsp;
              <MoreBooks />
            </p>
          ) : (
            <div>
              {cartItems.map((item) => (
                <div className="item" key={item.id}>
                  <span className="description">{item.description}</span>
                  <span className="cost">${item.cost.toFixed(2)}</span>
                  <span className="action">
                    <Button
                      onClick={() => dispatch(cartActions.remove(item.id))}
                    >
                      Remove
                    </Button>
                  </span>
                </div>
              ))}
              <p>Total: ${total.toFixed(2)}</p>
              <Button
                disabled={status !== 'ready'}
                onClick={() => dispatch(checkoutCart(cartItems))}
              >
                Checkout
              </Button>
            </div>
          )}
        </>
      )}
    </StyledCartFeature>
  );
};

export default CartFeature;
