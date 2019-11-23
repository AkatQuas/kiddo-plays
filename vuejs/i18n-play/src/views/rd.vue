<template>
    <div>
  <p><i>basic</i> --> {{ $t('rd.key1') }}</p>

  <p><i>nested </i> --> {{ $t('rd.nested.message1') }}</p>

  <p><i>array</i> -->  {{ $t('rd.errors[0]') }}</p>

  <p> <i>object in array </i>   -->  {{ $t('rd.errors[1].internal1') }}</p>
    
  <p><i>  array in array</i> --> {{ $t('rd.errors[2][0]') }}</p>
  <p><i>linked fields</i> --> {{ $t('rd.linked') }}</p>
    </div>
</template>

