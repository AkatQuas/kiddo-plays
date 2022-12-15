import { Button, Card, Divider, Spin } from 'antd';
import { useCallback, useRef } from 'react';
import Details from '../Details';
import useDelayedValue from '../useDelayedValue';
import ModalForm from './modal-form';

export default () => {
  const {
    state: node,
    loading,
    setState: setNode,
  } = useDelayedValue({
    name: 'Node 3',
    ip: '300',
  });

  const mfRef = useRef(null);

  // node is a dependencies for this hook
  const onEdit = useCallback(() => {
    if (mfRef.current) {
      mfRef.current.openModal(node);
    }
  }, [node]);

  const refetch = useCallback(() => {
    setTimeout(() => {
      setNode({
        name: 'Node 3 updated!',
        ip: '302',
      });
    }, 200);
  }, []);

  return (
    <Card title="Communication">
      <div>
        <dl>
          <dt>Case 1</dt>
          <dd>
            <ol>
              <li>Click `Edit` button</li>
              <li>Make some change but close the form.</li>
            </ol>
          </dd>
          <dt>Case 2</dt>
          <dd>
            <ol>
              <li>Click `Edit` button</li>
              <li>Make some change and save the form.</li>
            </ol>
          </dd>
          <dt>Case 3</dt>
          <dd>
            <ol>
              <li>Click `Refetch` button to update the value.</li>
              <li>
                Click `Edit` button, and check out the values in the form.
              </li>
            </ol>
          </dd>
        </dl>
      </div>
      {loading ? (
        <Spin />
      ) : (
        <>
          <Details node={node} />
          <Button onClick={onEdit}>Edit Node</Button>
          &nbsp; &nbsp;
          <Button onClick={refetch}>Refetch Node</Button>
          <ModalForm
            ref={mfRef}
            onConfirm={async (payload) => {
              setNode(payload);
              return true;
            }}
          />
        </>
      )}
      <Divider />
      <div>
        <p>
          The data is passed via communication. So there's no risk on data
          synchronization.
        </p>
        <p>
          There's only one modal form. And the invoker doesn't need to keep the
          `open/close` state for the modal.
        </p>
      </div>
    </Card>
  );
};
