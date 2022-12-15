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
    name: 'Node 1',
    ip: '100',
  });
  const [open, setOpen] = useState(false);
  const onChange = useCallback(
    (payload) => {
      setNode((n) => ({
        ...n,
        ...payload,
      }));
    },
    [setNode]
  );

  return (
    <Card title="ShareMemory">
      <div>
        <dl>
          <dt>Case 1</dt>
          <dd>
            <ol>
              <li>Click `Edit` button</li>
              <li>Make some change and close the form.</li>
            </ol>
          </dd>
          <dt>Case 2</dt>
          <dd>
            <ol>
              <li>Click `Edit` button</li>
              <li>Make some change and save the form.</li>
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
          <Form
            onChange={onChange}
            open={open}
            node={node}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              console.log('Form Ok Clicked');
              console.log('Node :', node);
              setOpen(false);
            }}
          />
        </>
      )}
      <Divider />
      <p>
        Every change in the modal form would affect the original data model.
        There's no way going backwards.
      </p>
    </Card>
  );
};
