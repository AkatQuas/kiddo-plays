import { Button, Card, Divider, Spin } from 'antd';
import { useCallback, useState } from 'react';
import Details from '../Details';
import useDelayedValue from '../useDelayedValue';
import Form from './form';

export default () => {
  const {
    state: node,
    loading,
    setState: setNode,
  } = useDelayedValue({
    name: 'Node 2 in form',
    ip: '200',
  });
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(100);
  const onChange = useCallback(
    (payload) => {
      setNode((n) => ({
        ...n,
        ...payload,
      }));
    },
    [setNode]
  );

  const refetch = useCallback(() => {
    setTimeout(() => {
      setNode({
        name: 'Node 2 updated!',
        ip: '202',
      });
    }, 200);
  }, []);
  return (
    <Card title="ShareMemoryWithForm">
      <div>
        <dl>
          <dt>Case 1</dt>
          <dd>
            <ol>
              <li>Click `Edit` button</li>
              <li>Make some change but close the form.</li>
              <li>
                Click `Edit` button again to check out the form value. Then save
                the form. Check out the details.
              </li>
            </ol>
          </dd>
          <dt>Case 2 ( follow case 1 ) </dt>
          <dd>
            <ol>
              <li>Click `Refetch` button to update the data model.</li>
              <li>
                Click `Edit` button to open the form, check out the values.
              </li>
              <li>Click `re-render` button to re-create a modal form.</li>
              <li>Click `Edit` button to open the form.</li>
            </ol>
          </dd>
        </dl>
      </div>
      {loading ? (
        <Spin />
      ) : (
        <>
          <Details node={node} />
          <Button onClick={() => setOpen(true)}>Edit Node</Button>
          &nbsp; &nbsp;
          <Button onClick={refetch}>Refetch Node</Button>
          &nbsp; &nbsp;
          <Button
            onClick={() => {
              setKey(
                Date.now().toString(36) + Math.random().toString(32).slice(2)
              );
            }}
          >
            Re - render
          </Button>
          <Form
            key={key}
            onChange={onChange}
            open={open}
            node={node}
            onCancel={() => setOpen(false)}
            onConfirm={(payload) => {
              console.log('Form Ok Clicked');
              console.log('Node :', payload);
              setNode(payload);
              setOpen(false);
            }}
          />
        </>
      )}
      <Divider />
      <div>
        <p>
          The data is used as initial value for each form, but the form only
          changes its copy.
        </p>
        <p>
          The state is kept by the form instance, even if we update the current
          data object.
        </p>
        <p>
          We have to re-initialize the form if we need the data synchronization.
        </p>
      </div>
    </Card>
  );
};
