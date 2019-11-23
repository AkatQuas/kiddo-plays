<template>
    <div>
        <p>config the <i>dateTimeFormats</i> fields in the <i>I18n</i> initialize option</p>
   <p>en -> {{ $d(new Date(), 'short') }}</p>
  <p>cn -> {{ $d(new Date(), 'long', 'cn') }}</p>
</div>

</template>

