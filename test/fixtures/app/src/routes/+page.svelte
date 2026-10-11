<script>
  let { data, form } = $props();
</script>
<h1>SSR {data.marker} {data.binding}</h1>
{#if form}<p>{form.message}</p>{/if}
