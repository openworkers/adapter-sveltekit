import { describe, test } from 'bun:test';
import { generateParamsModule } from '../src/lib/generate-params';

describe('generateParamsModule', () => {
  test('empty params', () => {
    const code = generateParamsModule('/');
    console.log('Empty params:');
    console.log(code);
    console.log('');
  });

  test('required params', () => {
    const code = generateParamsModule('/api/users/[id]/posts/[slug]');
    console.log('Required params:');
    console.log(code);
    console.log('');
  });

  test('optional param', () => {
    const code = generateParamsModule('/status/[code]/[[reason]]');
    console.log('Optional param:');
    console.log(code);
    console.log('');
  });

  test('rest param', () => {
    const code = generateParamsModule('/drip/[...params]');
    console.log('Rest param:');
    console.log(code);
    console.log('');
  });
});

// THE TEST FRAMEWORK I WANT 
