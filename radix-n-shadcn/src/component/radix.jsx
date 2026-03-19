import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Section,
  Text,
  Theme,
  ThemePanel as TP,
} from '@radix-ui/themes';
import { DecorativeBox } from './decorative-box';

const ThemePanel = TP;

const MyApp = () => {
  return (
    <>
      <Container>
        <Flex direction="column" gap="2">
          <Text>Hello from Radix Themes :)</Text>
          <Button>Let's go</Button>
        </Flex>
      </Container>
      <Section>
        <Flex gap="2">
          <Text>Hello from Radix Themes :)</Text>
          <Button>Let's go</Button>
        </Flex>
      </Section>
      <Box
        style={{
          background: 'var(--gray-a2)',
          borderRadius: 'var(--radius-3)',
        }}
      >
        <Container size="1" height="100px">
          <DecorativeBox>
            <Box p="9" />
          </DecorativeBox>
        </Container>
      </Box>
      <Grid columns="3" gap="3" rows="repeat(2, 64px)" width="auto">
        <DecorativeBox />
        <DecorativeBox />
        <DecorativeBox />
        <DecorativeBox />
        <DecorativeBox />
        <DecorativeBox />
      </Grid>
      <Box>
        <span>what in box</span>
      </Box>
      <Box asChild>
        <span>what in box</span>
      </Box>
    </>
  );
};

export const RadixApp = ({}) => {
  // <Theme accentColor="purple" panelBackground="solid" radius="small"></Theme>
  return (
    <Theme>
      <MyApp />
    </Theme>
  );
};
